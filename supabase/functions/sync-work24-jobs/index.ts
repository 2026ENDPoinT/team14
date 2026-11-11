// Supabase Edge Function: 고용24 공채속보 목록 → public.job_postings 저장
//
// 배포: supabase functions deploy sync-work24-jobs --no-verify-jwt
//   (실행 권한은 JWT 대신 x-sync-secret 헤더로 직접 확인한다)
//
// 호출 예 (수동 1회 실행):
//   POST https://<project-ref>.supabase.co/functions/v1/sync-work24-jobs?pages=3
//   헤더: x-sync-secret: <SYNC_SECRET 값>
//
// 필요한 환경 변수:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — 자동 제공 (서버 전용)
//   SYNC_SECRET                             — 수집 실행 권한 확인용 (기존 수집 함수와 같은 값)
//   WORK24_API_KEY                          — 고용24 인증키. 키와 키가 들어간 요청 주소는 로그·응답에 남기지 않는다.
//
// 수집 범위: 목록 1~pages 페이지(기본 3, 최대 10), 페이지당 PAGE_SIZE건. 필터 없이 전체 공채속보를 저장한다.
// 확인 모드: ?dryRun=1 이면 1페이지만 받아 결과를 보여 주고 저장하지 않는다.
//   &career=30(신입) 또는 40(인턴)을 붙이면 공식 필터 empWantedCareerCd로 조회한다. (확인 모드에서만)
// 실패 시: 고용24 오류(<GO24><error>), HTTP 오류, 형식이 다른 응답, 저장 실패 → 아무것도 바꾸지 않는다. (삭제하는 코드 없음)

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { USER_AGENT, forbidden, intParam, isAuthorized, json } from '../_shared/sync-common.ts'
import { API_URL, type JobPosting, SOURCE, parseWork24List, uniqueBySourceId } from './work24.ts'

const PAGE_SIZE = 100
const DEFAULT_PAGES = 3
const MAX_PAGES = 10
const PAGE_DELAY_MS = 500 // 고용24 서버 부담을 줄이기 위해 페이지 사이에 쉰다

// 오류 문구에서 인증키와 요청 주소의 쿼리를 지운다 (로그·응답에 키가 남지 않게)
function safeMessage(error: unknown, apiKey: string): string {
  let text = String(error instanceof Error ? error.message : error)
  if (apiKey) text = text.split(apiKey).join('***')
  return text.replace(/(https?:\/\/[^\s?"']+)\?[^\s"']*/g, '$1?…')
}

const CAREER_CODES = ['30', '40'] // 고용24 공식 코드: 30 신입, 40 인턴

// 시크릿 값 정리: 등록할 때 앞뒤에 섞인 공백·줄바꿈·따옴표를 뗀다 (키 자체는 바꾸지 않음)
function cleanKey(raw: string): string {
  return raw.trim().replace(/^["']+|["']+$/g, '').trim()
}

async function fetchPage(apiKey: string, page: number, career: string | null = null): Promise<string> {
  const params = new URLSearchParams({
    authKey: apiKey,
    callTp: 'L',
    returnType: 'XML',
    startPage: String(page),
    display: String(PAGE_SIZE),
  })
  if (career) params.set('empWantedCareerCd', career)
  const response = await fetch(`${API_URL}?${params}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error(`page ${page}: HTTP ${response.status}`)
  return await response.text()
}

Deno.serve(async (request) => {
  // 1. 실행 권한 확인
  if (!isAuthorized(request)) return forbidden()
  const apiKey = cleanKey(Deno.env.get('WORK24_API_KEY') ?? '')
  if (!apiKey) return json({ error: { code: 'SERVER_ERROR', message: 'WORK24_API_KEY가 설정되지 않음' } }, 500)
  const pages = intParam(request, 'pages', DEFAULT_PAGES, 1, MAX_PAGES)

  // 확인 모드: 1페이지만 받아 보여 주고 저장하지 않는다
  const query = new URL(request.url).searchParams
  if (query.get('dryRun') === '1') {
    const career = CAREER_CODES.includes(query.get('career') ?? '') ? query.get('career') : null
    try {
      const xml = await fetchPage(apiKey, 1, career)
      const parsed = parseWork24List(xml)
      if (!parsed.ok) throw new Error(parsed.error)
      return json({
        dryRun: true,
        career,
        apiTotal: parsed.total,
        items: parsed.items.length,
        skippedRows: parsed.skipped,
        elementNames: [...new Set([...xml.matchAll(/<([A-Za-z]\w*)>/g)].map((m) => m[1]))],
        sample: parsed.items.slice(0, 5),
      })
    } catch (error) {
      const message = safeMessage(error, apiKey)
      console.error(`sync-work24-jobs 확인 실패: ${message}`)
      return json({ error: { code: 'SERVER_ERROR', message: `확인 실패: ${message}` } }, 502)
    }
  }

  // 2. 목록 수집 (한 페이지라도 실패하면 저장하지 않는다)
  const collected: JobPosting[] = []
  let total: number | null = null
  let skipped = 0
  let pagesFetched = 0
  try {
    for (let page = 1; page <= pages; page++) {
      if (page > 1) await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS))
      const parsed = parseWork24List(await fetchPage(apiKey, page))
      if (!parsed.ok) throw new Error(`page ${page}: ${parsed.error}`)
      pagesFetched = page
      if (page === 1) {
        total = parsed.total
        if (parsed.items.length === 0) throw new Error('1페이지에 공고가 없음 (예상과 다른 응답)')
      }
      collected.push(...parsed.items)
      skipped += parsed.skipped
      if (parsed.items.length < PAGE_SIZE) break // 마지막 페이지
    }
  } catch (error) {
    const message = safeMessage(error, apiKey)
    console.error(`sync-work24-jobs 수집 실패: ${message}`)
    return json({ error: { code: 'SERVER_ERROR', message: `수집 실패: ${message}` } }, 502)
  }

  // 3. 저장: (source, source_id)가 같으면 수정(마감일 등 갱신), 없으면 추가 → 같은 공고는 항상 한 건
  const now = new Date().toISOString()
  const postings = uniqueBySourceId(collected).map((posting) => ({ ...posting, last_seen_at: now }))
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
  const countRows = async () => {
    const { count, error } = await supabase
      .from('job_postings')
      .select('id', { count: 'exact', head: true })
      .eq('source', SOURCE)
    if (error) throw error
    return count ?? 0
  }

  try {
    const before = await countRows()
    const { error } = await supabase.from('job_postings').upsert(postings, { onConflict: 'source,source_id' })
    if (error) throw error
    const after = await countRows()

    return json({
      source: SOURCE,
      pagesFetched,
      apiTotal: total,                    // 고용24가 알려 준 전체 건수
      parsedRows: collected.length,
      uniquePostings: postings.length,
      skippedRows: skipped,               // ID·공고명이 없어 건너뛴 행
      withoutDeadline: postings.filter((p) => !p.deadline).length, // 마감일이 비었거나 날짜 형식이 아님
      withoutUrl: postings.filter((p) => !p.url).length,
      rowsBefore: before,
      rowsAfter: after,
      inserted: after - before,
      sample: postings.slice(0, 3),
    })
  } catch (error) {
    console.error(`sync-work24-jobs 저장 실패: ${JSON.stringify(error)}`)
    return json({ error: { code: 'SERVER_ERROR', message: `저장 실패: ${JSON.stringify(error)}` } }, 500)
  }
})

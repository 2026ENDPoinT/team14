// Supabase Edge Function: 서울과기대 대외활동 게시판 공고 수집 → public.contests 저장
//
// 배포: supabase functions deploy sync-contests --no-verify-jwt
//   (실행 권한은 JWT 대신 x-sync-secret 헤더로 직접 확인한다)
//
// 호출 예 (수동 1회 실행):
//   POST https://<project-ref>.supabase.co/functions/v1/sync-contests?pages=3
//   헤더: x-sync-secret: <SYNC_SECRET 값>
//
// 필요한 환경 변수 (Supabase가 자동 제공 / secrets로 설정):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — 자동 제공 (서버 전용, 프론트에 절대 넣지 않음)
//   SYNC_SECRET                              — 직접 설정. 아무나 수집을 실행하지 못하게 막는다.
//
// 수집 범위: 목록 1~pages 페이지(기본 3, 최대 5). 한 페이지는 일반 글 8건 + 고정 공지 2건.
// 실패 시: 한 페이지라도 못 가져오거나 저장에 실패하면 아무것도 바꾸지 않는다. (삭제하는 코드 없음)

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { tagTitle } from '../_shared/interest-tags.ts'
import { USER_AGENT, forbidden, intParam, isAuthorized, json } from '../_shared/sync-common.ts'
import { BASE_URL, SOURCE, parseContestList, uniqueBySourceId } from './parse.ts'

const MAX_PAGES = 5
const DEFAULT_PAGES = 3
const PAGE_DELAY_MS = 1000 // 학교 서버 부담을 줄이기 위해 페이지 사이에 쉰다

async function fetchPage(page: number): Promise<string> {
  const response = await fetch(`${BASE_URL}?page=${page}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) throw new Error(`page ${page}: HTTP ${response.status}`)
  return await response.text()
}

Deno.serve(async (request) => {
  // 1. 실행 권한 확인
  if (!isAuthorized(request)) return forbidden()
  const pages = intParam(request, 'pages', DEFAULT_PAGES, 1, MAX_PAGES)

  // 2. 목록 페이지 수집
  const collected = []
  try {
    for (let page = 1; page <= pages; page++) {
      if (page > 1) await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS))
      const items = parseContestList(await fetchPage(page))
      // 1페이지가 비면 게시판 형식이 바뀐 것으로 보고 저장하지 않는다
      if (items.length === 0 && page === 1) throw new Error('1페이지에서 공고를 찾지 못함 (형식 변경?)')
      if (items.length === 0) break // 마지막 페이지를 지남
      collected.push(...items)
    }
  } catch (error) {
    return json({ error: { code: 'SERVER_ERROR', message: `수집 실패: ${error}` } }, 502)
  }

  // 3. 같은 원본 ID는 하나로 (upsert 한 번에 같은 키가 두 번 들어가면 오류가 난다) + 제목으로 관심 분야 태그
  const now = new Date().toISOString()
  const contests = uniqueBySourceId(collected).map((contest) => ({
    ...contest,
    tags: tagTitle(contest.title),
    last_seen_at: now,
  }))

  // 4. 저장: (source, source_id)가 이미 있으면 수정, 없으면 추가 → 같은 공고는 항상 한 건
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const countRows = async () => {
    const { count, error } = await supabase
      .from('contests')
      .select('id', { count: 'exact', head: true })
      .eq('source', SOURCE)
    if (error) throw error
    return count ?? 0
  }

  try {
    const before = await countRows()
    const { error } = await supabase
      .from('contests')
      .upsert(contests, { onConflict: 'source,source_id' })
    if (error) throw error
    const after = await countRows()

    return json({
      source: SOURCE,
      pagesFetched: pages,
      parsedRows: collected.length,      // 페이지별 행 합계 (고정 공지 중복 포함)
      uniqueContests: contests.length,   // 원본 ID 기준 중복 제거 후
      rowsBefore: before,
      rowsAfter: after,
      inserted: after - before,          // 새로 추가된 공고 수 (나머지는 갱신)
      tagged: contests.filter((c) => c.tags.length > 0).length,
      sample: contests.slice(0, 3),
    })
  } catch (error) {
    return json({ error: { code: 'SERVER_ERROR', message: `저장 실패: ${JSON.stringify(error)}` } }, 500)
  }
})

// Supabase Edge Function: Hacker News 공식 API 새 글 → public.tech_articles 저장
//
// 배포: supabase functions deploy sync-hacker-news --no-verify-jwt
// 호출 예 (수동 1회 실행):
//   POST https://<project-ref>.supabase.co/functions/v1/sync-hacker-news?limit=100
//   헤더: x-sync-secret: <SYNC_SECRET 값>
//
// 수집 범위: newstories(최신 글 ID 최대 500개) 중 앞에서부터 limit개(기본 100, 최대 200)만 상세 조회한다.
//           → 매번 "가장 최근 글 일부"만 보며, 그보다 오래된 글은 다시 가져오지 않는다.
// 실패 시: 목록을 못 가져오거나 저장에 실패하면 아무것도 바꾸지 않는다. (삭제하는 코드 없음)

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { USER_AGENT, forbidden, intParam, isAuthorized, json } from '../_shared/sync-common.ts'
import { API_BASE, SOURCE, type TechArticle, toTechArticle } from './hn.ts'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 200
const CONCURRENCY = 10 // 한 번에 동시에 보내는 상세 요청 수

async function getJson(path: string) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return await response.json()
}

Deno.serve(async (request) => {
  if (!isAuthorized(request)) return forbidden()
  const limit = intParam(request, 'limit', DEFAULT_LIMIT, 1, MAX_LIMIT)

  // 1. 새 글 ID 목록
  let ids: number[]
  try {
    const all = await getJson('/newstories.json')
    if (!Array.isArray(all) || all.length === 0) throw new Error('newstories가 비어 있음')
    ids = all.slice(0, limit)
  } catch (error) {
    return json({ error: { code: 'SERVER_ERROR', message: `목록 수집 실패: ${error}` } }, 502)
  }

  // 2. 글 상세 (실패한 글은 건너뛰고 개수만 센다)
  const articles: TechArticle[] = []
  let failedItems = 0
  let skippedItems = 0
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const results = await Promise.allSettled(ids.slice(i, i + CONCURRENCY).map((id) => getJson(`/item/${id}.json`)))
    for (const result of results) {
      if (result.status === 'rejected') { failedItems++; continue }
      const article = toTechArticle(result.value)
      if (article) articles.push(article)
      else skippedItems++
    }
  }
  if (articles.length === 0) {
    return json({ error: { code: 'SERVER_ERROR', message: `저장할 글 없음 (상세 실패 ${failedItems}건)` } }, 502)
  }

  // 3. 저장: (source, source_id)가 같으면 수정, 없으면 추가 → 다시 실행해도 같은 글은 한 건
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
  const countRows = async () => {
    const { count, error } = await supabase
      .from('tech_articles')
      .select('id', { count: 'exact', head: true })
      .eq('source', SOURCE)
    if (error) throw error
    return count ?? 0
  }

  try {
    const before = await countRows()
    const { error } = await supabase.from('tech_articles').upsert(articles, { onConflict: 'source,source_id' })
    if (error) throw error
    const after = await countRows()

    return json({
      source: SOURCE,
      requestedIds: ids.length,         // 새 글 목록 앞에서부터 본 개수
      newestId: ids[0],
      oldestId: ids[ids.length - 1],
      saved: articles.length,           // 저장(추가 또는 갱신)한 글
      skippedItems,                     // 원문 URL 없음·삭제·story 아님
      failedItems,                      // 상세 요청 실패
      rowsBefore: before,
      rowsAfter: after,
      inserted: after - before,
      tagged: articles.filter((a) => a.tags.length > 0).length,
      sample: articles.slice(0, 3),
    })
  } catch (error) {
    return json({ error: { code: 'SERVER_ERROR', message: `저장 실패: ${JSON.stringify(error)}` } }, 500)
  }
})

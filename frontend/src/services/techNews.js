import { supabase } from './supabaseClient.js'

// 기술 뉴스 목록 (기회 탐색 → 기술 뉴스)
// - 최신순으로 가져오기만 한다(기본 500개 ≈ 하루치). '관심 분야' 표시와 우선 정렬은 화면이 희망 직무와 제목으로 판단한다.
//   (features/explore/jobField.js newsFieldsOf · newsMatchesJob)
// - 예전 조회 함수(list_tech_articles_for_me)는 서버 태그가 하나라도 겹치면 먼저 정렬해 30개만 돌려줘서,
//   목록이 거의 '관심 분야' 글로만 채워졌다. 그래서 최신 글을 받아 화면에서 같은 기준으로 표시·정렬한다.
// 결과: { data: [{ id, source, sourceName, title, url, publishedAt, tags }] } 또는 { error }
export async function listRecentTechArticles(limit = 500) {
  if (!supabase) return { error: { code: 'SERVER_ERROR', message: 'Supabase 연결 설정(.env)이 없습니다.' } }
  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return { error: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' } }

  const { data, error } = await supabase
    .from('tech_articles')
    .select('id, source, source_name, title, url, published_at, tags')
    .order('published_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 1000))
  if (error) return { error: { code: 'SERVER_ERROR', message: '기술 뉴스를 불러오지 못했어요.' } }
  return {
    data: data.map((row) => ({
      id: row.id,
      source: row.source,
      sourceName: row.source_name,
      title: row.title,
      url: row.url,
      publishedAt: row.published_at,
      tags: row.tags,
    })),
  }
}

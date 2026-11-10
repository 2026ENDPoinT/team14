// Hacker News 공식 API 응답 → 기술 글 한 건
// https://github.com/HackerNews/API
// 외부 라이브러리 없이 동작하는 순수 함수 (Edge Function과 로컬 테스트에서 함께 사용)
//
// 저장하는 값: 제목, 출처명, 원문 URL, 게시 시각, 관심 분야 태그
// 저장하지 않는 값: 본문(text), 댓글(kids), 작성자, 점수 → 응답에 있어도 읽지 않는다.

import { tagTitle } from '../_shared/interest-tags.ts'

export const SOURCE = 'hacker_news'
export const SOURCE_NAME = 'Hacker News'
export const API_BASE = 'https://hacker-news.firebaseio.com/v0'

export type TechArticle = {
  source: string
  source_id: string
  source_name: string
  title: string
  url: string
  published_at: string // ISO 시각 (UTC)
  tags: string[]
}

// API의 item 중 이 함수가 읽는 필드만 적어 둔다.
type HnItem = {
  id?: number
  type?: string
  title?: string
  url?: string
  time?: number // 초 단위 Unix 시각
  deleted?: boolean
  dead?: boolean
}

// 저장하지 않는 글이면 null.
// - story가 아닌 것(댓글·투표·채용 글), 삭제·차단된 글
// - 원문 URL이 없는 글(Ask HN 등 본문만 있는 글): 본문을 저장하지 않으므로 보여줄 원문이 없다
export function toTechArticle(item: HnItem | null): TechArticle | null {
  if (!item || item.type !== 'story' || item.deleted || item.dead) return null
  if (typeof item.id !== 'number' || typeof item.time !== 'number') return null

  const title = (item.title ?? '').trim()
  const url = (item.url ?? '').trim()
  if (!title || !/^https?:\/\//i.test(url)) return null

  return {
    source: SOURCE,
    source_id: String(item.id),
    source_name: SOURCE_NAME,
    title,
    url,
    published_at: new Date(item.time * 1000).toISOString(),
    tags: tagTitle(title),
  }
}

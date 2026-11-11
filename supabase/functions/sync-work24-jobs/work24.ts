// 고용24 공채속보 목록 API(XML) → 채용 공고 목록
// 엔드포인트: https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L21.do (callTp=L, returnType=XML)
// 외부 라이브러리 없이 동작하는 순수 함수 (Edge Function과 Node 로컬 테스트에서 함께 사용)
//
// 저장하는 값: 원본 ID(empSeqno), 공고명(empWantedTitle), 기업명(empBusiNm),
//             마감일(empWantedEndt), 원문 링크(empWantedHomepgDetail)
// 컴공 관련 여부는 판단 근거가 없으므로 태그를 붙이지 않는다.

export const SOURCE = 'work24_open_recruit'
export const API_URL = 'https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L21.do'

export type JobPosting = {
  source: string
  source_id: string
  title: string
  company: string | null
  deadline: string | null // YYYY-MM-DD. 비었거나 날짜가 아니면 null
  deadline_raw: string | null // 원본 마감일 표기 (확인용)
  url: string | null // http(s) 원문 링크가 아니면 null
}

// 목록 한 페이지 해석 결과. 실패면 error에 이유를 담는다 (이때 저장하지 않는다)
export type ParsedPage =
  | { ok: true; total: number | null; items: JobPosting[]; skipped: number }
  | { ok: false; error: string }

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

// <name>값</name> 의 값 (없으면 null, 앞뒤 공백 제거)
function tag(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  if (!match) return null
  const value = decodeEntities(match[1]).replace(/\s+/g, ' ').trim()
  return value || null
}

// 마감일 → 'YYYY-MM-DD'. 'YYYYMMDD'·'YYYY-MM-DD'·'YYYY.MM.DD'만 받고, 실제 없는 날짜(2월 30일 등)는 null
export function toDate(raw: string | null): string | null {
  const match = raw?.match(/^(\d{4})[-.]?(\d{2})[-.]?(\d{2})$/)
  if (!match) return null
  const [, y, m, d] = match
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
  if (date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return null
  return `${y}-${m}-${d}`
}

// 공고 하나(<empSeqno>가 들어 있는 블록) → JobPosting. 필수값(ID·공고명)이 없으면 null
function toPosting(block: string): JobPosting | null {
  const id = tag(block, 'empSeqno')
  const title = tag(block, 'empWantedTitle')
  if (!id || !title) return null
  const deadlineRaw = tag(block, 'empWantedEndt')
  const link = tag(block, 'empWantedHomepgDetail')
  return {
    source: SOURCE,
    source_id: id,
    title,
    company: tag(block, 'empBusiNm'),
    deadline: toDate(deadlineRaw),
    deadline_raw: deadlineRaw,
    url: link && /^https?:\/\//i.test(link) ? link : null,
  }
}

// child 요소를 직접 감싸는 부모 요소 이름 (앞쪽 여는 태그 중 아직 닫히지 않은 가장 가까운 것)
function parentTagOf(xml: string, child: string): string | null {
  const at = xml.indexOf(`<${child}>`)
  if (at < 0) return null
  const before = xml.slice(0, at)
  const opens = [...before.matchAll(/<([A-Za-z][\w]*)>/g)].reverse()
  for (const open of opens) {
    const name = open[1]
    if (!before.slice(open.index! + open[0].length).includes(`</${name}>`)) return name
  }
  return null
}

// 응답 XML 한 페이지를 해석한다.
// - <GO24><error>…</error></GO24> (HTTP 200이어도) → 실패
// - 공고 블록을 하나도 못 찾고 total도 0이 아니면 → 형식이 바뀐 것으로 보고 실패
export function parseWork24List(xml: string): ParsedPage {
  const apiError = xml.match(/<error>([\s\S]*?)<\/error>/)
  if (apiError) return { ok: false, error: `고용24 오류: ${decodeEntities(apiError[1]).trim() || '내용 없음'}` }

  const totalText = tag(xml, 'total')
  const total = totalText !== null && /^\d+$/.test(totalText) ? Number(totalText) : null

  // 반복 요소 이름을 미리 정하지 않고, 첫 <empSeqno>를 감싼 요소 이름을 찾아 그 요소 단위로 나눈다
  const itemTag = parentTagOf(xml, 'empSeqno')
  const blocks = itemTag
    ? [...xml.matchAll(new RegExp(`<${itemTag}>([\\s\\S]*?)</${itemTag}>`, 'g'))].map((m) => m[1])
    : []

  if (blocks.length === 0) {
    if (total === 0) return { ok: true, total: 0, items: [], skipped: 0 }
    return { ok: false, error: '응답에서 공고 목록을 찾지 못함 (형식 변경?)' }
  }

  const items: JobPosting[] = []
  let skipped = 0
  for (const block of blocks) {
    const posting = toPosting(block)
    if (posting) items.push(posting)
    else skipped++
  }
  return { ok: true, total, items, skipped }
}

// 같은 원본 ID는 마지막 것 하나만 (upsert 한 번에 같은 키가 두 번 들어가면 오류)
export function uniqueBySourceId(items: JobPosting[]): JobPosting[] {
  return [...new Map(items.map((item) => [item.source_id, item])).values()]
}

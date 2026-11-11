// 서울과기대 취업진로본부 대외활동 게시판 목록 HTML → 공고 목록
// https://job.seoultech.ac.kr/center/program
// 외부 라이브러리 없이 동작하는 순수 함수 (Deno Edge Function과 Node 테스트에서 함께 사용)

export const SOURCE = 'seoultech_center_program'
export const BASE_URL = 'https://job.seoultech.ac.kr/center/program'

export type Contest = {
  source: string
  source_id: string
  title: string
  source_tag: string | null
  source_status: string | null
  deadline: string | null // YYYY-MM-DD
  url: string
  is_pinned: boolean
}

// HTML 특수문자 되돌리기 (&amp; → & 등)
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function cleanText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

// 목록 한 페이지의 HTML에서 공고를 뽑는다. 형식이 맞지 않는 행은 건너뛴다.
export function parseContestList(html: string): Contest[] {
  const rows = html.match(/<tr class="body_tr">[\s\S]*?<\/tr>/g) ?? []
  const contests: Contest[] = []

  for (const row of rows) {
    const link = row.match(/href='\?do=view&(?:amp;)?bnum=(\d+)&(?:amp;)?bidx=(\d+)[^']*'>([\s\S]*?)<\/a>/)
    if (!link) continue
    const [, bnum, bidx, rawTitle] = link

    const fullTitle = cleanText(rawTitle)
    if (!fullTitle) continue

    // 제목 앞 [분류]
    const tagMatch = fullTitle.match(/^\[([^\]]+)\]\s*/)
    const status = row.match(/<td class="dn7"[^>]*>\s*([^<\s][^<]*?)\s*<\/td>/)
    const deadline = row.match(/class="body_col_regdate[^"]*"[^>]*>\s*(\d{4}-\d{2}-\d{2})\s*</)

    contests.push({
      source: SOURCE,
      source_id: bidx,
      title: fullTitle,
      source_tag: tagMatch ? tagMatch[1].trim() : null,
      source_status: status ? cleanText(status[1]) : null,
      deadline: deadline ? deadline[1] : null,
      url: `${BASE_URL}?do=view&bnum=${bnum}&bidx=${bidx}`,
      is_pinned: row.includes('ico_notice'),
    })
  }
  return contests
}

// 같은 원본 ID는 하나만 남긴다. (고정 공지는 모든 페이지에 반복해서 나온다)
export function uniqueBySourceId(contests: Contest[]): Contest[] {
  const map = new Map<string, Contest>()
  for (const contest of contests) {
    if (!map.has(contest.source_id)) map.set(contest.source_id, contest)
  }
  return [...map.values()]
}

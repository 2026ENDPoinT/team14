// 내 기록 내보내기: 일기 + 로드맵을 PDF로 저장한다.
// - 새 패키지 없이 브라우저 인쇄 기능을 쓴다. 인쇄 창에서 '대상: PDF로 저장'을 고르면 PDF 파일이 된다.
// - 서버 데이터는 읽기만 한다. (일기: diaryStore, 로드맵: services getRoadmap)
// - 사진 파일 자체는 담지 않고, 몇 장 있었는지만 적는다.
import { getRoadmap } from '../../services/api.js'
import { listDiaries, loadDiaries } from '../diary/diaryStore.js'
import { getTodayKST } from '../diary/dateUtils.js'
import { themeLabel } from '../roadmap/layout.js'
import { jobTitle } from './jobGroups.js'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function dateWithDay(date) {
  const [y, m, d] = date.split('-').map(Number)
  return `${y}. ${m}. ${d}. (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`
}

// 사용자가 쓴 글을 HTML에 그대로 넣지 않도록 특수 문자를 바꾼다
function esc(text) {
  return String(text ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function nodeHtml(node, documents) {
  const body = documents[node.id]?.content?.body
  const memo = typeof body === 'string' && body.trim() ? `<p class="memo">${esc(body.trim())}</p>` : ''
  return `<li>
    <span class="title">${esc(node.title)}</span>
    <span class="tag">${esc(themeLabel(node.theme))}</span>${node.completed ? '<span class="tag done">완료</span>' : ''}
    ${memo}
  </li>`
}

export function buildHtml({ profile, diaries, roadmap, title }) {
  const { periods, nodes, documents } = roadmap
  const periodBlocks = [...periods]
    .sort((a, b) => a.order - b.order)
    .map((period) => {
      const inPeriod = nodes.filter((n) => n.periodId === period.id)
      if (inPeriod.length === 0) return ''
      return `<h3>${esc(period.name)}</h3><ul>${inPeriod.map((n) => nodeHtml(n, documents)).join('')}</ul>`
    })
    .join('')
  const stored = nodes.filter((n) => !n.periodId)
  const storedBlock = stored.length
    ? `<h3>보관함</h3><ul>${stored.map((n) => nodeHtml(n, documents)).join('')}</ul>`
    : ''

  const diaryBlocks = diaries.length
    ? diaries.map((d) => `<article class="diary">
        <p class="date">${dateWithDay(d.date)}</p>
        <p class="content">${esc(d.content?.trim() || '(내용 없음)')}</p>
        ${d.photoUrls?.length ? `<p class="photo">사진 ${d.photoUrls.length}장</p>` : ''}
      </article>`).join('')
    : '<p class="empty">아직 쓴 일기가 없어요.</p>'

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; color: #222; font-size: 11pt; line-height: 1.6; }
  header { padding-bottom: 10px; border-bottom: 2px solid #f2d68f; margin-bottom: 18px; }
  header h1 { margin: 0; font-size: 20pt; }
  header p { margin: 4px 0 0; color: #777; font-size: 9.5pt; }
  .profile { display: flex; gap: 18px; margin: 0 0 22px; padding: 10px 14px; background: #f6f6f6; border-radius: 8px; font-size: 10pt; }
  .profile b { color: #555; margin-right: 4px; }
  h2 { font-size: 14pt; margin: 26px 0 10px; padding-left: 8px; border-left: 4px solid #f2d68f; }
  h3 { font-size: 11.5pt; margin: 14px 0 6px; color: #555; }
  ul { margin: 0; padding-left: 18px; }
  li { margin: 4px 0; break-inside: avoid; }
  .tag { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 4px; background: #eee; color: #666; font-size: 8.5pt; }
  .tag.done { background: #f8e6ad; color: #555; }
  .memo { margin: 2px 0 0; color: #666; font-size: 9.5pt; white-space: pre-wrap; }
  .diary { padding: 8px 0; border-bottom: 1px solid #eee; break-inside: avoid; }
  .date { margin: 0; font-weight: 700; color: #555; font-size: 10pt; }
  .content { margin: 2px 0 0; white-space: pre-wrap; }
  .photo, .empty { margin: 2px 0 0; color: #999; font-size: 9pt; }
</style></head>
<body>
  <header>
    <h1>Campus Roadmap · 내 기록</h1>
    <p>내보낸 날짜: ${getTodayKST()}</p>
  </header>
  <div class="profile">
    <span><b>닉네임</b>${esc(profile.nickname)}</span>
    <span><b>학년</b>${esc(profile.grade)}학년</span>
    ${profile.desiredJob ? `<span><b>희망 직무</b>${esc(jobTitle(profile.desiredJob))}</span>` : ''}
  </div>
  <h2>로드맵 (활동 ${nodes.length}개)</h2>
  ${periodBlocks || '<p class="empty">아직 로드맵에 활동이 없어요.</p>'}
  ${storedBlock}
  <h2>일기 (${diaries.length}개)</h2>
  ${diaryBlocks}
</body></html>`
}

// 보이지 않는 틀(iframe)에 문서를 넣고 인쇄 창을 연다 (팝업 차단에 걸리지 않게 새 창 대신 iframe)
function printHtml(html) {
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  doc.open()
  doc.write(html)
  doc.close()
  // 인쇄 창을 닫은 뒤 틀을 지운다
  frame.contentWindow.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 0))
  setTimeout(() => {
    frame.contentWindow.focus()
    frame.contentWindow.print()
  }, 300) // 글꼴·레이아웃이 그려질 시간
}

// 성공: { data: { title } } / 실패: { error: { message } }
export async function exportMyRecords(profile) {
  await loadDiaries()
  const diaries = listDiaries('0000-01-01', '9999-12-31')
  const roadmap = await getRoadmap()
  if (roadmap.error) return { error: roadmap.error }

  const title = `campus-roadmap-내기록-${getTodayKST()}` // PDF로 저장할 때 기본 파일 이름이 된다
  printHtml(buildHtml({ profile, diaries, roadmap: roadmap.data, title }))
  return { data: { title } }
}

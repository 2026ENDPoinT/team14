// 노드 목표일·마감일(dueDate) → D-DAY 표시
// - dueDate: 'YYYY-MM-DD' 문자열 (시간 없음). 나중에 DB nodes.due_date(date)와 같은 형식
// - 오늘 날짜는 한국 시간(Asia/Seoul) 기준

const KST_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

// 한국 시간 기준 오늘 'YYYY-MM-DD'
export function todayKST(now = new Date()) {
  return KST_DATE.format(now) // en-CA 형식이 YYYY-MM-DD
}

// 'YYYY-MM-DD' 두 날짜 사이의 일수 (시간대 영향이 없도록 UTC 자정끼리 비교)
function daysBetween(from, to) {
  const toUTC = (d) => {
    const [y, m, day] = d.split('-').map(Number)
    return Date.UTC(y, m - 1, day)
  }
  return Math.round((toUTC(to) - toUTC(from)) / 86400000)
}

// D-DAY 정보: { label, tone } / dueDate가 없으면 null
// tone: 'soon'(D-7 ~ D-DAY, 빨간색) | 'later'(D-8 이상, 회색) | 'past'(지난 날짜, 흐리게)
export function ddayInfo(dueDate, now = new Date()) {
  if (!dueDate) return null
  const left = daysBetween(todayKST(now), dueDate)
  if (left === 0) return { label: 'D-DAY', tone: 'soon' }
  if (left > 0) return { label: `D-${left}`, tone: left <= 7 ? 'soon' : 'later' }
  return { label: `D+${-left}`, tone: 'past' }
}

// 공고 표시 규칙 (탐색 카드·로드맵의 대외활동·채용 노드에서 같이 쓴다)

// 수집처 키 → 화면에 보일 출처 이름
const SOURCE_NAMES = {
  seoultech_center_program: '서울과기대 대외활동',
  work24_open_recruit: '고용24',
}

export function sourceName(source) {
  return SOURCE_NAMES[source] ?? source
}

// 한국 날짜 오늘 'YYYY-MM-DD' (한국은 서머타임이 없어 항상 UTC+9)
export function kstToday(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// 마감까지 남은 날 수. 오늘 마감 = 0, 어제 마감 = -1. 마감일이 없으면 null (추정하지 않음)
export function daysLeft(deadline, today = kstToday()) {
  if (!deadline) return null
  return Math.round((Date.parse(deadline) - Date.parse(today)) / 86400000)
}

// 마감 배지: null(표시 안 함) 또는 { label, tone }
//   tone 'urgent' : D-7 ~ D-1, D-day → 빨간 배지
//   tone 'normal' : D-8 이상
//   tone 'closed' : 마감일이 지났거나 수집처가 '마감'으로 표시한 공고
export function deadlineBadge(deadline, { status = null, today = kstToday() } = {}) {
  const days = daysLeft(deadline, today)
  if (status === '마감' || (days !== null && days < 0)) return { label: '마감', tone: 'closed' }
  if (days === null) return null
  if (days === 0) return { label: 'D-day', tone: 'urgent' }
  return { label: `D-${days}`, tone: days <= 7 ? 'urgent' : 'normal' }
}

// 대외활동 공고의 실제 분류 (제목 앞 [분류]). 분류가 없으면 '대외활동'
export function contestKindLabel(sourceTag) {
  return sourceTag || '대외활동'
}

// 로드맵에 추가할 수 없는 이유. 추가할 수 있으면 null
// 분류(공모전·멘토링·설명회 등)와 상관없이 모두 추가할 수 있고, 이미 마감된 공고만 막는다.
// (서버 RPC add_contest_to_roadmap·add_job_posting_to_roadmap도 같은 규칙으로 다시 확인한다)
export function addBlockReason({ deadline, status = null }, today = kstToday()) {
  const days = daysLeft(deadline, today)
  if (status === '마감' || (days !== null && days < 0)) return '이미 마감된 공고라 로드맵에 추가할 수 없어요.'
  return null
}

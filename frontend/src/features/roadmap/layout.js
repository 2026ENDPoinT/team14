// 로드맵 캔버스 크기·좌표 계산 (화면 배치 전용 값)

export const COLUMN_WIDTH = 630 // 학기 컬럼 하나의 너비
export const CANVAS_LEFT = 120 // 첫 학기 원의 x 위치
export const TIMELINE_Y = 200 // 가로 타임라인의 y 위치
export const CANVAS_HEIGHT = 900

// 노드 테마 (SPEC 6.4)
export const THEMES = [
  { id: 'major', label: '전공·학업' },
  { id: 'project', label: '프로젝트' },
  { id: 'external', label: '대외활동' },
  { id: 'career', label: '진로·취업' },
  { id: 'research', label: '연구·진학' },
  { id: 'event', label: '대학생활 이벤트' },
  { id: 'free', label: '자유 노드' },
]

export function themeLabel(themeId) {
  return THEMES.find((t) => t.id === themeId)?.label ?? themeId
}

// 교과목 노드는 타임라인 위의 작은 카드로 보여 준다
export function isCourse(node) {
  return node.originKey?.startsWith('course:')
}

export function cardSize(node) {
  return isCourse(node) ? { w: 166, h: 84 } : { w: 226, h: 120 }
}

// "1-1" 같은 짧은 학기 표시
export function periodLabel(period) {
  if (period.type !== 'semester') return period.name
  const match = period.name.match(/(\d)학년 (\d)학기/)
  return match ? `${match[1]}-${match[2]}` : period.name
}

export function columnX(order) {
  return CANVAS_LEFT + order * COLUMN_WIDTH
}

// 캔버스 전체 기준 노드 위치
export function nodeBox(node, periods) {
  const period = periods.find((p) => p.id === node.periodId)
  if (!period || !node.position) return null
  const { w, h } = cardSize(node)
  return { x: columnX(period.order) + node.position.x, y: node.position.y, w, h }
}

// 새 노드를 학기 컬럼의 빈 아래쪽에 배치
export function nextPosition(nodes, periodId) {
  const bottoms = nodes
    .filter((n) => n.periodId === periodId && !isCourse(n))
    .map((n) => n.position.y + cardSize(n).h)
  const y = Math.max(300, ...bottoms.map((b) => b + 40))
  return { x: 240, y: Math.min(y, CANVAS_HEIGHT - 140) }
}

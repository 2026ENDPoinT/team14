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

// ───────── 노드 드래그 (2단계) ─────────

// 캔버스 좌표 (x, y)가 속한 학기. 학기 영역 밖이면 null
// 학기 영역: 기준 원(columnX)부터 다음 학기 기준 원 직전까지, 높이는 캔버스 전체
export function findPeriodAt(x, y, periods) {
  if (y < 0 || y > CANVAS_HEIGHT) return null
  return periods.find((p) => x >= columnX(p.order) && x < columnX(p.order) + COLUMN_WIDTH) ?? null
}

const GAP = 16 // 노드 사이(그리고 배지·타임라인과의) 최소 간격
const BADGE_SIZE = 64 // 학기 원형 배지 지름
const MIN_Y = TIMELINE_Y + GAP // 노드 윗변은 타임라인 선보다 이만큼 아래에 있어야 한다

function overlaps(a, b) {
  return (
    a.x < b.x + b.w + GAP && a.x + a.w + GAP > b.x &&
    a.y < b.y + b.h + GAP && a.y + a.h + GAP > b.y
  )
}

// 학기 원형 배지 영역 (노드가 피해야 하는 장애물)
function badgeBoxes(periods) {
  return periods.map((p) => ({
    x: columnX(p.order) - BADGE_SIZE / 2,
    y: TIMELINE_Y - BADGE_SIZE / 2,
    w: BADGE_SIZE,
    h: BADGE_SIZE,
  }))
}

// 보정 후보 위치: 놓은 자리에서 가까운 순서 (8px 간격, 최대 640px)
const OFFSETS = (() => {
  const list = []
  for (let dx = -640; dx <= 640; dx += 8) {
    for (let dy = -640; dy <= 640; dy += 8) list.push([dx, dy])
  }
  return list.sort((a, b) => Math.hypot(...a) - Math.hypot(...b))
})()

// 겹침 규칙에 맞게 위치를 보정한다. (이미 맞으면 그대로)
// - 다른 노드·학기 배지와 16px 이상 간격
// - 타임라인 선 아래에만 (윗변이 MIN_Y 이상), 캔버스 아래쪽 밖으로 나가지 않음
// - 보정 후에도 노드 중심이 같은 학기 안
// box: 캔버스 좌표 { x, y, w, h } / obstacles: 피해야 할 box 목록
export function resolveOverlap(box, obstacles, period) {
  const isFree = (b) =>
    b.y >= MIN_Y && b.y + b.h <= CANVAS_HEIGHT &&
    findPeriodAt(b.x + b.w / 2, b.y + b.h / 2, [period]) &&
    obstacles.every((o) => !overlaps(b, o))

  for (const [dx, dy] of OFFSETS) {
    const candidate = { ...box, x: box.x + dx, y: box.y + dy }
    if (isFree(candidate)) return candidate
  }
  return null // 빈 자리가 없음
}

// 노드를 캔버스 좌표 topLeft에 놓았을 때 저장할 { periodId, position } 계산.
// 노드 중심이 학기 영역 밖이거나 빈 자리가 없으면 null (원래 자리로 되돌린다)
// 캔버스 드래그와 보관함 드래그가 함께 쓴다.
export function placeNode(node, topLeft, nodes, periods) {
  const { w, h } = cardSize(node)
  const period = findPeriodAt(topLeft.x + w / 2, topLeft.y + h / 2, periods)
  if (!period) return null

  const obstacles = [
    ...nodes
      .filter((n) => n.status === 'placed' && n.id !== node.id)
      .map((n) => nodeBox(n, periods))
      .filter(Boolean),
    ...badgeBoxes(periods),
  ]
  const box = resolveOverlap({ x: topLeft.x, y: topLeft.y, w, h }, obstacles, period)
  if (!box) return null

  return {
    periodId: period.id,
    position: { x: Math.round(box.x - columnX(period.order)), y: Math.round(box.y) },
  }
}

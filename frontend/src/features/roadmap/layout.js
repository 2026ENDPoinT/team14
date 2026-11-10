// 로드맵 캔버스 크기·좌표 계산 (화면 배치 전용 값)

export const BASE_WIDTH = 630 // 학기 컬럼 기본 너비
export const MAX_WIDTH = 1890 // 학기 컬럼 최대 너비 (기본의 3배)
// 학기 오른쪽 여백: 노드는 (학기 너비 - EDGE)까지만 놓인다.
// 48 = 다음 학기 배지 반지름 32 + 최소 간격 16 → 다음 학기 배지와 자동으로 16px 이상 떨어진다
const EDGE = 48
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

// ───────── 학기 컬럼 배치 (자동 확장) ─────────

// 학기마다 x 위치와 너비를 계산한다. 데이터에 저장하지 않고 노드 배치로부터 계산한다.
// 너비 = max(기본 630, 학기 안 노드의 가장 오른쪽 끝 + 여백, 이번 세션에서 커졌던 너비)
// - keptWidths: { periodId: 너비 } 세션 동안 줄어들지 않게 붙잡아 두는 값 (새로고침하면 사라짐)
// 결과: { periods(순서대로), cols: { periodId: { x, width } }, width(캔버스 전체 너비) }
export function computeLayout(periods, nodes, keptWidths = {}) {
  const sorted = [...periods].sort((a, b) => a.order - b.order)
  const cols = {}
  let x = CANVAS_LEFT
  for (const period of sorted) {
    const rights = nodes
      .filter((n) => n.status === 'placed' && n.periodId === period.id && n.position)
      .map((n) => n.position.x + cardSize(n).w + EDGE)
    const width = Math.max(BASE_WIDTH, keptWidths[period.id] ?? 0, ...rights)
    cols[period.id] = { x, width }
    x += width
  }
  return { periods: sorted, cols, width: x }
}

// 캔버스 전체 기준 노드 위치
export function nodeBox(node, layout) {
  const col = layout.cols[node.periodId]
  if (!col || !node.position) return null
  const { w, h } = cardSize(node)
  return { x: col.x + node.position.x, y: node.position.y, w, h }
}

// 새 노드를 놓아 볼 첫 위치: 학기 컬럼의 기존 노드 아래쪽 (실제 위치는 placeNode로 겹침 보정)
export function nextPosition(nodes, periodId) {
  const bottoms = nodes
    .filter((n) => n.periodId === periodId && !isCourse(n))
    .map((n) => n.position.y + cardSize(n).h)
  const y = Math.max(300, ...bottoms.map((b) => b + 40))
  return { x: 240, y: Math.min(y, CANVAS_HEIGHT - 140) }
}

// ───────── 노드 배치 (드래그·보관함·새 노드 공통) ─────────

// 캔버스 좌표 (x, y)가 속한 학기. 학기 영역 밖이면 null
// 학기 영역: 기준 원(col.x)부터 다음 학기 기준 원 직전까지, 높이는 캔버스 전체
export function findPeriodAt(x, y, layout) {
  if (y < 0 || y > CANVAS_HEIGHT) return null
  return layout.periods.find((p) => {
    const col = layout.cols[p.id]
    return x >= col.x && x < col.x + col.width
  }) ?? null
}

const GAP = 16 // 노드 사이(그리고 배지·타임라인과의) 최소 간격
const BADGE_SIZE = 64 // 학기 원형 배지 지름
const MIN_Y = TIMELINE_Y + GAP // 일반 노드의 윗변은 타임라인 선보다 이만큼 아래에 있어야 한다
const SNAP = 24 // 교과목 노드 중심이 선 위쪽이거나 선 아래 이 거리 안이면 선 위에 딱 맞춘다
const NEAR = 240 // 학기를 넓히지 않고 찾아볼 거리: 이 안에 빈자리가 없을 때만 학기를 넓힌다
const STEP = 8 // 빈자리 탐색 간격(px)

function overlaps(a, b) {
  return (
    a.x < b.x + b.w + GAP && a.x + a.w + GAP > b.x &&
    a.y < b.y + b.h + GAP && a.y + a.h + GAP > b.y
  )
}

// 학기 원형 배지 영역 (노드가 피해야 하는 장애물)
function badgeBox(col) {
  return { x: col.x - BADGE_SIZE / 2, y: TIMELINE_Y - BADGE_SIZE / 2, w: BADGE_SIZE, h: BADGE_SIZE }
}

const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

// 영역 안에서 놓은 자리(target)와 가장 가까운 빈자리를 찾는다. 없으면 null
// area: 카드 왼쪽 위 꼭짓점이 놓일 수 있는 범위 { minX, maxX, minY, maxY }
// maxDist: 이 거리보다 먼 자리는 찾지 않음
function findFree(target, size, area, obstacles, maxDist = Infinity) {
  if (area.maxX < area.minX || area.maxY < area.minY) return null
  // 놓은 자리를 영역 안으로 당긴 점을 기준으로 8px 격자를 만든다 (경계 밖으로 삐져나오면 안쪽으로 보정)
  const baseX = clamp(target.x, area.minX, area.maxX)
  const baseY = clamp(target.y, area.minY, area.maxY)
  const xs = [], ys = []
  for (let x = baseX; x >= area.minX; x -= STEP) xs.push(x)
  for (let x = baseX + STEP; x <= area.maxX; x += STEP) xs.push(x)
  for (let y = baseY; y >= area.minY; y -= STEP) ys.push(y)
  for (let y = baseY + STEP; y <= area.maxY; y += STEP) ys.push(y)

  const candidates = []
  for (const x of xs) {
    for (const y of ys) {
      const d = Math.hypot(x - target.x, y - target.y)
      if (d <= maxDist) candidates.push({ x, y, d })
    }
  }
  candidates.sort((a, b) => a.d - b.d)
  for (const c of candidates) {
    const box = { x: c.x, y: c.y, ...size }
    if (obstacles.every((o) => !overlaps(box, o))) return box
  }
  return null
}

// 노드를 캔버스 좌표 topLeft에 놓았을 때 저장할 { periodId, position } 계산.
// 노드 중심이 학기 영역 밖이거나 빈자리가 전혀 없으면 null (원래 자리로 / 보관함으로)
// 캔버스 드래그, 보관함 드래그, 새 노드 생성이 함께 쓴다.
// - 학기 판정은 놓기 전 layout(고정된 경계) 기준, 노드 중심점으로
// - 일반 노드: 타임라인 선 아래에만
// - 교과목 노드: 선 위쪽·선 근처에 놓으면 선 위에 맞춤 (선을 따라 좌우로 보정), 그 밖에는 일반 노드처럼
// - 탐색 순서: ① 지금 학기 너비 안의 가까운 빈자리 → ② 최대 너비까지 넓힌 영역의 가장 가까운 빈자리
//   (②에서 고른 자리가 지금 너비를 넘으면 그만큼 학기가 넓어진다. 최대 너비에서는 남은 세로 공간까지 찾는다)
export function placeNode(node, topLeft, nodes, layout) {
  const { w, h } = cardSize(node)
  const period = findPeriodAt(topLeft.x + w / 2, topLeft.y + h / 2, layout)
  if (!period) return null
  const col = layout.cols[period.id]

  // 장애물: 같은 학기의 다른 노드 + 그 학기 배지
  // (다른 학기 노드는 영역이 겹치지 않는다. 학기가 넓어지면 뒤 학기는 통째로 밀려나므로 장애물이 아니다.
  //  다음 학기 배지와의 간격은 EDGE 여백으로 지켜진다)
  const obstacles = [
    ...nodes
      .filter((n) => n.status === 'placed' && n.periodId === period.id && n.id !== node.id)
      .map((n) => nodeBox(n, layout))
      .filter(Boolean),
    badgeBox(col),
  ]
  // 카드 왼쪽 위 꼭짓점이 놓일 수 있는 x 범위 (학기 너비 기준)
  const xRange = (width) => ({ minX: col.x, maxX: col.x + width - EDGE - w })
  const nowWidth = col.width
  const maxWidth = Math.max(MAX_WIDTH, col.width)
  const size = { w, h }

  let box = null
  // 교과목을 선 위쪽·선 근처에 놓았으면: 선 위에서만 좌우로 찾는다
  if (isCourse(node) && topLeft.y + h / 2 <= TIMELINE_Y + SNAP) {
    const lineY = TIMELINE_Y - h / 2
    const target = { x: topLeft.x, y: lineY }
    box =
      findFree(target, size, { ...xRange(nowWidth), minY: lineY, maxY: lineY }, obstacles) ??
      findFree(target, size, { ...xRange(maxWidth), minY: lineY, maxY: lineY }, obstacles)
  }
  // 그 밖의 경우(또는 선 위에 자리가 없을 때): 타임라인 선 아래
  if (!box) {
    const yRange = { minY: MIN_Y, maxY: CANVAS_HEIGHT - h }
    box =
      findFree(topLeft, size, { ...xRange(nowWidth), ...yRange }, obstacles, NEAR) ??
      findFree(topLeft, size, { ...xRange(maxWidth), ...yRange }, obstacles)
  }
  if (!box) return null

  return {
    periodId: period.id,
    position: { x: Math.round(box.x - col.x), y: Math.round(box.y) },
  }
}

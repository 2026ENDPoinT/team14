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

// 교과목 노드 (온보딩에서 만든 학교 교과목. docs/API.md: originKey "course:<과목 키>")
export function isCourse(node) {
  return node.originKey?.startsWith('course:')
}

// 타임라인 선 위에 놓일 수 있는 노드: 교과목 + 사용자가 만든 '전공·학업' 노드
export function canSitOnLine(node) {
  return isCourse(node) || node.theme === 'major'
}

// 지금 타임라인 선 위에 놓여 있는지: 카드 윗변이 선보다 위 (선 아래 노드는 윗변이 선 + 16px 아래부터)
// 따로 저장하는 값 없이 위치(position)로만 판단한다.
// 선 위에는 canSitOnLine 노드만 놓을 수 있으므로(placeNode) 종류는 다시 보지 않는다.
// → 선 위의 전공·학업 노드를 다른 종류로 바꿔도, 선 위에 있는 동안은 작은 카드 그대로 (선 아래로 옮기면 일반 카드)
export function isOnLine(node) {
  return node.status === 'placed' && Boolean(node.position) && node.position.y < TIMELINE_Y
}

// 작은 카드(제목만)로 보여 줄지: 교과목은 항상, 전공·학업 노드는 선 위에 있을 때만
export function isPill(node) {
  return isCourse(node) || isOnLine(node)
}

const PILL_SIZE = { w: 166, h: 84 }
const CARD_SIZE = { w: 226, h: 120 }

// 지금 그려지는 카드 크기 (충돌 검사·위치 계산·연결선이 모두 이 값을 쓴다)
export function cardSize(node) {
  return isPill(node) ? PILL_SIZE : CARD_SIZE
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
    .filter((n) => n.periodId === periodId && !isPill(n))
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
// - 교과목·전공·학업 노드: 선 위쪽·선 근처에 놓으면 선 위에 맞춤 (선을 따라 좌우로 보정), 그 밖에는 일반 노드처럼
//   전공·학업 노드는 선 위에서는 작은 카드, 선 아래에서는 일반 카드 → 놓을 자리의 크기로 계산하고 카드 중심을 기준으로 맞춘다
// - 탐색 순서: ① 지금 학기 너비 안의 가까운 빈자리 → ② 최대 너비까지 넓힌 영역의 가장 가까운 빈자리
//   (②에서 고른 자리가 지금 너비를 넘으면 그만큼 학기가 넓어진다. 최대 너비에서는 남은 세로 공간까지 찾는다)
export function placeNode(node, topLeft, nodes, layout) {
  const { w, h } = cardSize(node) // 끄는 동안의 크기
  const cx = topLeft.x + w / 2
  const cy = topLeft.y + h / 2
  const period = findPeriodAt(cx, cy, layout)
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
  // 카드 왼쪽 위 꼭짓점이 놓일 수 있는 x 범위 (학기 너비·카드 너비 기준)
  const xRange = (width, size) => ({ minX: col.x, maxX: col.x + width - EDGE - size.w })
  const nowWidth = col.width
  const maxWidth = Math.max(MAX_WIDTH, col.width)

  let box = null
  // 선 위쪽·선 근처에 놓았으면: 선 위에서만 좌우로 찾는다 (작은 카드 크기)
  if (canSitOnLine(node) && cy <= TIMELINE_Y + SNAP) {
    const size = PILL_SIZE
    const lineY = TIMELINE_Y - size.h / 2
    const target = { x: cx - size.w / 2, y: lineY }
    box =
      findFree(target, size, { ...xRange(nowWidth, size), minY: lineY, maxY: lineY }, obstacles) ??
      findFree(target, size, { ...xRange(maxWidth, size), minY: lineY, maxY: lineY }, obstacles)
  }
  // 그 밖의 경우(또는 선 위에 자리가 없을 때): 타임라인 선 아래 (교과목은 작은 카드, 나머지는 일반 카드)
  if (!box) {
    const size = isCourse(node) ? PILL_SIZE : CARD_SIZE
    const target = { x: cx - size.w / 2, y: cy - size.h / 2 }
    const yRange = { minY: MIN_Y, maxY: CANVAS_HEIGHT - size.h }
    box =
      findFree(target, size, { ...xRange(nowWidth, size), ...yRange }, obstacles, NEAR) ??
      findFree(target, size, { ...xRange(maxWidth, size), ...yRange }, obstacles)
  }
  if (!box) return null

  return {
    periodId: period.id,
    position: { x: Math.round(box.x - col.x), y: Math.round(box.y) },
  }
}

// ───────── 타임라인 위 자리 교환 ─────────

const SWAP_INSET = 8 // 끄는 카드의 중심이 대상 카드 안쪽(가장자리 8px 제외)에 있어야 자리 교환

// 노드를 topLeft(캔버스 좌표)에 놓으면 자리를 바꿀 타임라인 위 카드. 없으면 null
// - 선 위에 놓일 수 있는 노드(교과목·전공·학업)를 선 근처에 놓았을 때만
// canSwapWith: 자리 교환 대상이 될 수 있는 노드인지 (필터로 숨긴 노드는 제외)
export function findSwapTarget(node, topLeft, nodes, layout, canSwapWith = () => true) {
  if (!canSitOnLine(node)) return null
  const { w, h } = cardSize(node)
  const cx = topLeft.x + w / 2
  const cy = topLeft.y + h / 2
  if (cy > TIMELINE_Y + SNAP) return null
  return (
    nodes.find((n) => {
      if (n.id === node.id || !isOnLine(n) || !canSwapWith(n)) return false
      const b = nodeBox(n, layout)
      return b && cx > b.x + SWAP_INSET && cx < b.x + b.w - SWAP_INSET && cy > b.y + SWAP_INSET && cy < b.y + b.h - SWAP_INSET
    }) ?? null
  )
}

// 드래그한 노드를 놓았을 때 바뀔 위치 목록 [{ id, periodId, position }]. 놓을 수 없으면 null
// ① 같은 학기 선 위의 카드끼리: 두 카드 위치 교환 (작은 카드끼리라 크기가 같다)
// ② 다른 학기·선 아래에서 가져와 선 위 카드 B에 놓음: 끈 노드가 B 자리를 차지하고, B는 같은 선의 가장 가까운 빈자리로
// ③ 그 밖: placeNode (가까운 빈자리, 학기 자동 확장)
// 바뀌는 값은 periodId·position뿐 (완료 상태·연결선·기록은 노드 id 기준이라 그대로)
// nodes: 빈자리 계산은 항상 전체 노드 기준 (필터로 숨긴 노드도 자리를 차지한다)
export function planDrop(node, topLeft, nodes, layout, canSwapWith) {
  const target = findSwapTarget(node, topLeft, nodes, layout, canSwapWith)
  if (!target) {
    const placement = placeNode(node, topLeft, nodes, layout)
    return placement ? [{ id: node.id, ...placement }] : null
  }
  if (isOnLine(node) && node.periodId === target.periodId) {
    return [
      { id: node.id, periodId: target.periodId, position: { ...target.position } },
      { id: target.id, periodId: node.periodId, position: { ...node.position } },
    ]
  }
  const moved = { ...node, periodId: target.periodId, position: { ...target.position }, status: 'placed' }
  const rest = nodes.map((n) => (n.id === node.id ? moved : n))
  const b = nodeBox(target, layout)
  const placement = placeNode(target, { x: b.x, y: b.y }, rest, layout)
  if (!placement) return null
  return [
    { id: node.id, periodId: moved.periodId, position: moved.position },
    { id: target.id, ...placement },
  ]
}

// 첫 화면 위치: 학기 2.5개 정도가 보이는 배율, 타임라인은 화면 위에서 약 22% 지점
// - 노드 데이터(position, periodId)는 건드리지 않고 화면(viewport)만 정한다
// - 상단 반원 메뉴(높이 96px) 아래로 타임라인 위 교과목 카드(반 높이 42px)가 내려오게 한다
// - 가로: 노드가 놓인 가장 앞 학기부터 보여 준다 (빈 학기만 보이는 첫 화면 방지)
const VIEW_SEMESTERS = 2.5
const NAV_CLEAR = 96 + 16
export function initialViewport(screenW, screenH, layout, nodes) {
  const zoom = Math.round(Math.min(1, Math.max(0.6, screenW / (VIEW_SEMESTERS * BASE_WIDTH + CANVAS_LEFT))) * 100) / 100
  const lineY = Math.max(screenH * 0.22, NAV_CLEAR + 42 * zoom)
  const placedXs = nodes.filter((n) => n.status === 'placed' && layout.cols[n.periodId]).map((n) => layout.cols[n.periodId].x)
  const startX = placedXs.length ? Math.min(...placedXs) : CANVAS_LEFT
  return { x: Math.round(-(startX - CANVAS_LEFT) * zoom), y: Math.round(lineY - TIMELINE_Y * zoom), zoom }
}

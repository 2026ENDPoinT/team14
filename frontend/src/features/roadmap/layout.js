// 로드맵 캔버스 크기·좌표 계산 (화면 배치 전용 값)

// 학기 컬럼 너비 (가로 자동 확장)
// - 기본 1000: 일반 카드(226) 3개가 넉넉한 간격(64)으로 한 줄에 들어가는 너비 (3×226 + 64×2 + 오른쪽 여백 48 = 854)
// - 노드를 오른쪽으로 놓으면 그 노드 오른쪽 끝 + 여백까지 학기가 넓어지고(최대 3배), 뒤 학기들은 그만큼 오른쪽으로 밀린다
// - 노드를 빼거나 지우면 다시 필요한 만큼으로 줄어든다 (노드보다 좁아지지는 않음)
export const BASE_WIDTH = 1000 // 학기 기본 너비 (800 → 1000: 학기 안 가로 여유)
export const MAX_WIDTH = 3000 // 학기 컬럼 최대 너비 (기본의 3배)
// 학기 오른쪽 여백: 노드는 (학기 너비 - EDGE)까지만 놓인다.
// 48 = 다음 학기 배지 반지름 32 + 최소 간격 16 → 다음 학기 배지와 자동으로 16px 이상 떨어진다
const EDGE = 48
// 학기 안 가로 여유 (교과목이 학기 선에 촘촘히 붙어 보이지 않게)
export const COURSE_START = 132 // 학기 선 → 첫 교과목 카드 (배지 오른쪽 끝에서 100px)
export const COURSE_GAP = 90 // 타임라인 위 교과목 카드 사이
const TRAIL_PAD = 132 // 마지막 카드 → 다음 학기 선 (다음 학기 배지 왼쪽 끝까지 100px)
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
  { id: 'free', label: '자유 활동' },
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
export const MEMO_SIZE = { w: 260, h: 220 } // 메모 노드 기본 크기: 일반 활동 카드보다 조금 크게 (긴 글은 안에서 스크롤)
export const MEMO_MIN = { w: 220, h: 160 }
export const MEMO_MAX = { w: 600, h: 500 }
// 메모 크기: 사용자가 바꾼 크기(node.size, node_documents.content.width·height)가 있으면 그것, 없으면 기본
export function memoSizeOf(content) {
  const clamp = (v, min, max, d) => (Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d)
  return { w: clamp(content?.width, MEMO_MIN.w, MEMO_MAX.w, MEMO_SIZE.w), h: clamp(content?.height, MEMO_MIN.h, MEMO_MAX.h, MEMO_SIZE.h) }
}

// 메모 노드: 캔버스에 내용이 늘 보이는 자유 메모 (nodes.category_key = 'memo', 내용·색·크기는 node_documents.content)
// 배치·겹침·학기 너비·관계선·가지선은 일반 활동 노드와 같은 규칙 (크기만 사용자가 바꿀 수 있다)
export const MEMO_KEY = 'memo'
export function isMemo(node) {
  return node?.categoryId === MEMO_KEY
}

// 지금 그려지는 카드 크기 (충돌 검사·위치 계산·연결선이 모두 이 값을 쓴다)
export function cardSize(node) {
  if (isMemo(node)) return node.size ?? MEMO_SIZE
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
// 너비 = max(기본 1000, 학기 안 노드의 가장 오른쪽 끝 + 여백, 잠깐 붙잡아 둔 너비)
// - keptWidths: { periodId: 너비 } 노드를 넓어진 학기에서 뒤 학기로 옮긴 직후에만 앞 학기 너비를 붙잡아 둔다
//   (바로 줄면 방금 놓은 노드가 왼쪽으로 튀어 보이므로). 다음 변경 때 노드 기준으로 다시 줄어든다 (RoadmapPage)
// 결과: { periods(순서대로), cols: { periodId: { x, width } }, width(캔버스 전체 너비) }
export function computeLayout(periods, nodes, keptWidths = {}) {
  const sorted = [...periods].sort((a, b) => a.order - b.order)
  const cols = {}
  let x = CANVAS_LEFT
  for (const period of sorted) {
    // 마지막 카드 오른쪽에 TRAIL_PAD만큼 비워 둔다 → 다음 학기 배지와 100px 이상 떨어진다
    const rights = nodes
      .filter((n) => n.status === 'placed' && n.periodId === period.id && n.position)
      .map((n) => n.position.x + cardSize(n).w + TRAIL_PAD)
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

// 드래그한 노드를 놓을 학기
// - 원래 학기(P)에 있던 노드를 오른쪽으로 끌 때: 카드 왼쪽 끝이 P의 오른쪽 경계(다음 학기 선)를 넘기 전까지는 P
//   → 카드 일부가 경계를 넘어도 P에 놓이고 P가 넓어진다 (학기를 넓히려는 드래그)
//   → 카드 전체가 다음 학기 선을 넘으면 다음 학기로 이동 (학기를 옮기려는 드래그)
// - 그 밖(왼쪽으로 끌기, 보관함·새 노드): 카드 중심이 있는 학기 (findPeriodAt)
export function dropPeriodFor(node, topLeft, layout) {
  const { w, h } = cardSize(node)
  const cx = topLeft.x + w / 2
  const cy = topLeft.y + h / 2
  const col = node.status === 'placed' && node.periodId ? layout.cols[node.periodId] : null
  if (col && cy >= 0 && cy <= CANVAS_HEIGHT && cx >= col.x && topLeft.x < col.x + col.width) {
    return layout.periods.find((p) => p.id === node.periodId) ?? null
  }
  return findPeriodAt(cx, cy, layout)
}

// 캔버스 좌표 (x, y)가 속한 학기. 학기 영역 밖이면 null
// 학기 영역: 기준 원(col.x)부터 다음 학기 기준 원 직전까지, 높이는 캔버스 전체
export function findPeriodAt(x, y, layout) {
  if (y < 0 || y > CANVAS_HEIGHT) return null
  return layout.periods.find((p) => {
    const col = layout.cols[p.id]
    return x >= col.x && x < col.x + col.width
  }) ?? null
}

const GAP = 16 // 노드 사이(그리고 배지·타임라인과의) 최소 간격 — 사용자가 직접 끌어 놓을 때
export const AUTO_GAP = 64 // 자동 배치(새 노드·새 교과목) 때 카드 사이 간격: 촘촘해 보이지 않게
const BADGE_SIZE = 64 // 학기 원형 배지 지름
const MIN_Y = TIMELINE_Y + GAP // 일반 노드의 윗변은 타임라인 선보다 이만큼 아래에 있어야 한다
const SNAP = 24 // 교과목 노드 중심이 선 위쪽이거나 선 아래 이 거리 안이면 선 위에 딱 맞춘다
const STEP = 8 // 빈자리 탐색 간격(px)

function overlaps(a, b, gap = GAP) {
  return (
    a.x < b.x + b.w + gap && a.x + a.w + gap > b.x &&
    a.y < b.y + b.h + gap && a.y + a.h + gap > b.y
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
function findFree(target, size, area, obstacles, maxDist = Infinity, gap = GAP) {
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
    if (obstacles.every((o) => !overlaps(box, o, gap))) return box
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
// - 놓은 자리에서 가장 가까운 빈자리 (최대 너비까지). 지금 너비를 넘으면 그만큼 학기가 넓어진다
//   (예전에는 지금 너비 안의 빈자리를 먼저 찾아서, 오른쪽에 놓아도 안쪽·아래 줄로 당겨지고 학기가 넓어지지 않았다)
// options.gap: 다른 카드와의 최소 간격 (기본 16 = 직접 끌어 놓기, 자동 배치는 AUTO_GAP)
export function placeNode(node, topLeft, nodes, layout, { gap = GAP } = {}) {
  const { w, h } = cardSize(node) // 끄는 동안의 크기
  const cx = topLeft.x + w / 2
  const cy = topLeft.y + h / 2
  const period = dropPeriodFor(node, topLeft, layout)
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
  const maxWidth = Math.max(MAX_WIDTH, col.width)

  let box = null
  // 선 위쪽·선 근처에 놓았으면: 선 위에서만 좌우로 찾는다 (작은 카드 크기)
  if (canSitOnLine(node) && cy <= TIMELINE_Y + SNAP) {
    const size = PILL_SIZE
    const lineY = TIMELINE_Y - size.h / 2
    const target = { x: cx - size.w / 2, y: lineY }
    box = findFree(target, size, { ...xRange(maxWidth, size), minY: lineY, maxY: lineY }, obstacles, Infinity, gap)
  }
  // 그 밖의 경우(또는 선 위에 자리가 없을 때): 타임라인 선 아래 (교과목은 작은 카드, 나머지는 일반 카드)
  if (!box) {
    const size = isCourse(node) ? PILL_SIZE : isMemo(node) ? MEMO_SIZE : CARD_SIZE
    const target = { x: cx - size.w / 2, y: cy - size.h / 2 }
    const yRange = { minY: MIN_Y, maxY: CANVAS_HEIGHT - size.h }
    box = findFree(target, size, { ...xRange(maxWidth, size), ...yRange }, obstacles, Infinity, gap)
  }
  if (!box) return null

  return {
    periodId: period.id,
    position: { x: Math.round(box.x - col.x), y: Math.round(box.y) },
  }
}

// 같은 학기 안 두 노드가 겹치는지 (학기 기준 좌표, 최소 간격 GAP 포함) — 메모 크기 바꾸기 확인용
export function nodesOverlap(a, b) {
  if (!a.position || !b.position) return false
  return overlaps({ ...a.position, ...cardSize(a) }, { ...b.position, ...cardSize(b) })
}
export const MIN_NODE_Y = TIMELINE_Y + 16 // 선 아래 노드 윗변의 최소 y (placeNode의 MIN_Y와 같은 값)

// ───────── 새 일반 활동의 기본 위치 (활동 추가 창에서 학기를 골랐을 때만) ─────────
// 드래그·보관함 배치는 placeNode 그대로 (사용자가 놓은 자리 존중). 이미 저장된 노드 좌표는 바꾸지 않는다.
// 교과목·전공·학업 노드는 예전 규칙 그대로 (선 위에 놓일 수 있는 노드).
// 일반 활동은 학기 가지선이 다른 카드와 이어진 것처럼 보이지 않게:
//   ① 다른 카드와 40px 이상 띄운다 (드래그는 16px)
//   ② 타임라인 위 교과목 카드 바로 밑에 붙지 않는다: 선 아래로 충분히 내려가고, 교과목 카드와 겹치는 세로줄이면 더 내려간다
//   ③ 새 카드의 가지선(줄기 → 카드 왼쪽 가로선)이 다른 카드를 지나가지 않고, 다른 카드의 가지선도 새 카드를 지나가지 않게
const CREATE_GAP = AUTO_GAP
const CREATE_MIN_Y = TIMELINE_Y + PILL_SIZE.h / 2 + 64 // 선 위 카드 아래 끝 + 64
const UNDER_PILL_Y = TIMELINE_Y + PILL_SIZE.h / 2 + 120 // 교과목 카드와 같은 세로줄이면 이만큼 더 아래
const CREATE_MIN_X = 96 // 학기 기준: 가지선 줄기(배지 오른쪽 48 + 줄기 간격 28)보다 오른쪽
const BRANCH_CLEAR = 12 // 가지선 가로줄과 카드 사이 최소 거리

const near = (a, b, gap) =>
  a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y

export function placeNewNode(node, periodId, nodes, layout) {
  const col = layout.cols[periodId]
  if (!col) return null
  const start = nextPosition(nodes, periodId)
  if (canSitOnLine(node)) return placeNode(node, { x: col.x + start.x, y: start.y }, nodes, layout, { gap: AUTO_GAP })

  const size = CARD_SIZE
  const others = nodes
    .filter((n) => n.status === 'placed' && n.periodId === periodId && n.id !== node.id)
    .map((n) => ({ node: n, box: nodeBox(n, layout) }))
    .filter((o) => o.box)
  const pills = others.filter((o) => isOnLine(o.node)).map((o) => o.box)
  const cards = others.filter((o) => !isOnLine(o.node)).map((o) => o.box) // 가지선이 있는 카드
  const badge = badgeBox(col)
  const maxX = col.x + Math.max(MAX_WIDTH, col.width) - EDGE - size.w
  const minX = col.x + CREATE_MIN_X
  const maxY = CANVAS_HEIGHT - size.h

  const ok = (box) => {
    if (near(box, badge, CREATE_GAP)) return false
    if ([...pills, ...cards].some((o) => near(box, o, CREATE_GAP))) return false
    // 교과목 카드와 같은 세로줄(좌우 24px 여유)이면 더 아래로
    if (pills.some((p) => box.x < p.x + p.w + 24 && box.x + box.w + 24 > p.x) && box.y < UNDER_PILL_Y) return false
    const ty = box.y + box.h / 2
    for (const c of cards) {
      const cy = c.y + c.h / 2
      // 다른 카드의 가지선 가로줄(줄기 → 그 카드 왼쪽)이 새 카드를 지나감
      if (box.x < c.x && box.y - BRANCH_CLEAR < cy && cy < box.y + box.h + BRANCH_CLEAR) return false
      // 새 카드의 가지선 가로줄이 다른 카드를 지나감
      if (c.x < box.x && c.y - BRANCH_CLEAR < ty && ty < c.y + c.h + BRANCH_CLEAR) return false
    }
    return true
  }

  // 기본 시작점(기존 카드 아래쪽)에서 가까운 자리부터
  const target = { x: Math.max(minX, col.x + start.x), y: Math.max(CREATE_MIN_Y, start.y) }
  const candidates = []
  for (let x = minX; x <= maxX; x += STEP) {
    for (let y = CREATE_MIN_Y; y <= maxY; y += STEP) {
      candidates.push({ x, y, d: Math.hypot(x - target.x, (y - target.y) * 1.5) }) // 같은 거리면 가로보다 세로 이동을 덜 선호
    }
  }
  candidates.sort((a, b) => a.d - b.d)
  for (const c of candidates) {
    const box = { x: c.x, y: c.y, ...size }
    if (ok(box)) return { periodId, position: { x: Math.round(c.x - col.x), y: Math.round(c.y) } }
  }
  // 조건에 맞는 자리가 없으면 예전 규칙(가까운 빈자리)
  return placeNode(node, { x: col.x + start.x, y: start.y }, nodes, layout)
}

// ───────── 새 일반 활동을 위해 교과목을 오른쪽으로 밀기 ─────────
// 새 일반 활동 카드와 그 가지선(카드 왼쪽 55px의 줄기 + 여유) 위쪽 타임라인에 교과목 카드가 있으면
// 학기 가지선이 교과목에서 내려와 새 활동과 이어진 것처럼 보인다.
// → 그 자리(lane)에 걸치거나 그보다 오른쪽에 있는 타임라인 위 카드(교과목·전공·학업)를 순서 그대로 한 묶음으로
//   lane 오른쪽 끝 너머까지 같은 거리만큼 민다. lane보다 왼쪽에 있는 카드는 그대로.
// 결과: { placement, moves }  moves = [{ id, periodId, position }] (저장할 교과목 위치. 없으면 빈 배열)
// 학기 너비·뒤 학기 위치·선은 노드 위치로 다시 계산되므로 따로 옮길 필요가 없다.
const LANE_LEFT = 95 // 새 카드 왼쪽으로 비워 둘 거리 (가지선 줄기 55 + 여유 40)
export function planNewNodeSpace(node, periodId, nodes, layout) {
  if (canSitOnLine(node)) return { placement: placeNewNode(node, periodId, nodes, layout), moves: [] }
  const onLine = (n) => n.status === 'placed' && n.periodId === periodId && isOnLine(n)
  const pills = nodes.filter(onLine).sort((a, b) => a.position.x - b.position.x)
  // 새 카드 자리: 교과목은 밀어낼 것이므로 장애물에서 빼고 찾는다
  const placement = placeNewNode(node, periodId, nodes.filter((n) => !onLine(n)), layout)
  if (!placement || placement.periodId !== periodId || pills.length === 0) return { placement, moves: [] }

  const laneStart = placement.position.x - LANE_LEFT
  const laneEnd = placement.position.x + CARD_SIZE.w + AUTO_GAP
  const first = pills.findIndex((p) => p.position.x + PILL_SIZE.w > laneStart)
  if (first < 0) return { placement, moves: [] }
  const group = pills.slice(first)
  let shift = Math.max(0, laneEnd - group[0].position.x)
  if (shift === 0) return { placement, moves: [] }

  // 민 자리에서 다른 카드(선 아래 카드·새 카드)와 겹치면 더 민다 (학기 기준 좌표로 비교)
  const rel = (n) => ({ x: n.position.x, y: n.position.y, ...cardSize(n) })
  const fixed = [
    ...nodes.filter((n) => n.status === 'placed' && n.periodId === periodId && !onLine(n)).map(rel),
    { x: placement.position.x, y: placement.position.y, ...CARD_SIZE },
  ]
  for (let i = 0; i < 400; i += 1) {
    const hit = group.some((p) => fixed.some((f) => overlaps({ x: p.position.x + shift, y: p.position.y, ...PILL_SIZE }, f)))
    if (!hit) break
    shift += STEP
  }
  const moves = group.map((p) => ({ id: p.id, periodId, position: { x: Math.round(p.position.x + shift), y: p.position.y } }))
  return { placement, moves }
}

// ───────── 타임라인 위 교과목 간격 맞추기 (불러올 때) ─────────
// 예전 규칙으로 촘촘하게 저장된 교과목을 널널하게: 학기마다 '타임라인 위에 있는 교과목'만
// (originKey 'course:' = 온보딩이 자동으로 놓은 과목, 선 위 = 자동 배치 자리) 순서 그대로 오른쪽으로만 민다.
//   첫 카드는 학기 선에서 COURSE_START 이상, 카드 사이는 COURSE_GAP 이상. 이미 넉넉하면 움직이지 않는다.
// 건드리지 않는 것: 일반 활동·사용자가 만든 전공·학업 노드·선 아래로 옮긴 교과목 (수동 배치로 본다).
//   밀린 교과목이 이런 카드와 겹치면 겹치지 않을 때까지 더 민다.
// 결과: 저장할 [{ id, periodId, position }] (바꿀 것이 없으면 빈 배열)
export function respaceCourses(periods, nodes) {
  const moves = []
  for (const period of periods) {
    const inPeriod = nodes.filter((n) => n.status === 'placed' && n.periodId === period.id && n.position)
    const courses = inPeriod.filter((n) => isCourse(n) && isOnLine(n)).sort((a, b) => a.position.x - b.position.x)
    if (courses.length === 0) continue
    const fixed = inPeriod
      .filter((n) => !courses.includes(n))
      .map((n) => ({ x: n.position.x, y: n.position.y, ...cardSize(n) }))
    let cursor = COURSE_START
    for (const c of courses) {
      let x = Math.max(c.position.x, cursor)
      for (let i = 0; i < 600 && fixed.some((f) => overlaps({ x, y: c.position.y, ...PILL_SIZE }, f)); i += 1) x += STEP
      if (x !== c.position.x) moves.push({ id: c.id, periodId: period.id, position: { x, y: c.position.y } })
      cursor = x + PILL_SIZE.w + COURSE_GAP
    }
  }
  return moves
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
const VIEW_COLUMN = 630 // 첫 화면 배율 계산용 (기본 너비를 넓혀도 카드가 작아 보이지 않게 예전 너비 기준)
const NAV_CLEAR = 96 + 16
export function initialViewport(screenW, screenH, layout, nodes) {
  const zoom = Math.round(Math.min(1, Math.max(0.6, screenW / (VIEW_SEMESTERS * VIEW_COLUMN + CANVAS_LEFT))) * 100) / 100
  const lineY = Math.max(screenH * 0.22, NAV_CLEAR + 42 * zoom)
  const placedXs = nodes.filter((n) => n.status === 'placed' && layout.cols[n.periodId]).map((n) => layout.cols[n.periodId].x)
  const startX = placedXs.length ? Math.min(...placedXs) : CANVAS_LEFT
  return { x: Math.round(-(startX - CANVAS_LEFT) * zoom), y: Math.round(lineY - TIMELINE_Y * zoom), zoom }
}

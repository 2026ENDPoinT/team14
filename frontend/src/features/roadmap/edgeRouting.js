// 노드 관계선 경로 계산 (직각 경로 탐색)
// - 주변 카드의 가장자리 선으로 격자를 만들고, 카드를 피하면서
//   "길이 + 꺾임 수"가 가장 적은 직각 경로를 찾는다. (A* 탐색)
// - 출발·도착 접점은 카드의 위·아래·오른쪽 중에서 탐색이 함께 고른다.
//   카드 왼쪽 가운데는 완료 표시등 자리라 접점으로 쓰지 않는다.
// - 같은 카드의 같은 변에 여러 선이 붙으면 접점을 고르게 나눠 뭉치지 않게 한다.
// - 모서리는 둥글게 (피그마의 회색 곡선 스타일)

const STUB = 18 // 카드에서 수직으로 빠져나오는 길이
const RADIUS = 18 // 꺾이는 모서리 둥글기
const CLEAR = 10 // 다른 카드와 띄울 거리
const OWN = 12 // 자기 카드와 띄울 거리 (STUB보다 작아야 함)
const BEND = 40 // 꺾임 1번의 비용 (길이 px로 환산)
const REGION = 400 // 두 카드 주변 이 거리 안의 카드만 장애물로 본다 (계산량 줄이기)
const TIMELINE_Y = 200 // 학기 타임라인 높이 (layout.js와 같은 값). 이 선 위를 따라 달리는 경로는 피한다
const SIDES = ['top', 'bottom', 'right']
const DIR = { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, right: { x: 1, y: 0 } }
// 카드 모서리가 둥글어서 변의 곧은 부분 근처에만 접점을 둔다 (변 길이에 대한 비율)
const RANGE = { top: [0.25, 0.75], bottom: [0.25, 0.75], right: [0.25, 0.75] }
const MOVES = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]

const dist = (p, q) => Math.hypot(q.x - p.x, q.y - p.y)
const same = (a, b) => Math.abs(a - b) < 0.5
const inflate = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + m * 2, h: r.h + m * 2 })
const strictlyInside = (x, y, r) => x > r.x + 0.01 && x < r.x + r.w - 0.01 && y > r.y + 0.01 && y < r.y + r.h - 0.01

// 카드 변 위의 접점과, 거기서 STUB만큼 나온 점
function port(box, side, t = 0.5) {
  const p = side === 'top' ? { x: box.x + box.w * t, y: box.y }
    : side === 'bottom' ? { x: box.x + box.w * t, y: box.y + box.h }
      : { x: box.x + box.w, y: box.y + box.h * t }
  const d = DIR[side]
  return { side, p, q: { x: p.x + d.x * STUB, y: p.y + d.y * STUB }, dir: d }
}

// 같은 방향으로 이어지는 점·겹치는 점 정리 (되돌아가는 점은 지우지 않는다)
function simplify(pts) {
  const out = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && same(last.x, p.x) && same(last.y, p.y)) continue
    out.push(p)
    while (out.length >= 3) {
      const [a, b, c] = out.slice(-3)
      const straight = (same(a.x, b.x) && same(b.x, c.x) && (b.y - a.y) * (c.y - b.y) > 0) ||
        (same(a.y, b.y) && same(b.y, c.y) && (b.x - a.x) * (c.x - b.x) > 0)
      if (straight) out.splice(-2, 1)
      else break
    }
  }
  return out
}

// 작은 우선순위 큐 (A* 탐색용)
class Heap {
  constructor() { this.a = [] }
  get size() { return this.a.length }
  push(item) {
    const a = this.a
    a.push(item)
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p].f <= a[i].f) break
      ;[a[p], a[i]] = [a[i], a[p]]
      i = p
    }
  }
  pop() {
    const a = this.a
    const top = a[0]
    const last = a.pop()
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l].f < a[m].f) m = l
        if (r < a.length && a[r].f < a[m].f) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i], a[m]]
        i = m
      }
    }
    return top
  }
}

// 카드 A → 카드 B 직각 경로. sidesA/sidesB: 쓸 수 있는 변, tA/tB: 변별 접점 위치
// 결과: { pts, sa, sb } 또는 null (길이 없음)
function search(A, B, others, { sidesA = SIDES, sidesB = SIDES, tA = {}, tB = {} } = {}) {
  const region = inflate(
    {
      x: Math.min(A.x, B.x),
      y: Math.min(A.y, B.y),
      w: Math.max(A.x + A.w, B.x + B.w) - Math.min(A.x, B.x),
      h: Math.max(A.y + A.h, B.y + B.h) - Math.min(A.y, B.y),
    },
    REGION,
  )
  const near = (o) => o.x < region.x + region.w && o.x + o.w > region.x && o.y < region.y + region.h && o.y + o.h > region.y
  const blocks = [...others.filter(near).map((o) => inflate(o, CLEAR)), inflate(A, OWN), inflate(B, OWN)]
  const blocked = (x, y) => blocks.some((r) => strictlyInside(x, y, r))

  const starts = sidesA.map((s) => port(A, s, tA[s])).filter((pt) => !blocked(pt.q.x, pt.q.y))
  const goals = sidesB.map((s) => port(B, s, tB[s])).filter((pt) => !blocked(pt.q.x, pt.q.y))
  if (!starts.length || !goals.length) return null

  // 격자: 장애물 가장자리 + 접점 앞 점 + 탐색 영역 끝
  const xsSet = new Set([region.x, region.x + region.w])
  const ysSet = new Set([region.y, region.y + region.h])
  for (const r of blocks) { xsSet.add(r.x); xsSet.add(r.x + r.w); ysSet.add(r.y); ysSet.add(r.y + r.h) }
  for (const pt of [...starts, ...goals]) { xsSet.add(pt.q.x); ysSet.add(pt.q.y) }
  const xs = [...xsSet].sort((a, b) => a - b)
  const ys = [...ysSet].sort((a, b) => a - b)
  const xi = new Map(xs.map((x, i) => [x, i]))
  const yi = new Map(ys.map((y, i) => [y, i]))
  const NY = ys.length

  const goalAt = new Map() // 격자 점 → 도착 접점들
  for (const g of goals) {
    const k = xi.get(g.q.x) * NY + yi.get(g.q.y)
    if (!goalAt.has(k)) goalAt.set(k, [])
    goalAt.get(k).push(g)
  }
  const h = (x, y) => Math.min(...goals.map((g) => Math.abs(g.q.x - x) + Math.abs(g.q.y - y)))
  const moveIndex = (d) => MOVES.findIndex((m) => m.x === d.x && m.y === d.y)

  // 상태 = (격자 점, 마지막 이동 방향)
  const best = new Map()
  const parent = new Map()
  const heap = new Heap()
  // 카드에서 나오는 짧은 선이 타임라인 위에 놓이면(타임라인 위 교과목의 오른쪽) 타임라인처럼 보이므로 피한다
  const onTimeline = (pt) => pt.dir.y === 0 && Math.abs(pt.p.y - TIMELINE_Y) < 8
  for (const s of starts) {
    const i = xi.get(s.q.x)
    const j = yi.get(s.q.y)
    const d = moveIndex(s.dir)
    const key = (i * NY + j) * 4 + d
    const g0 = STUB + (onTimeline(s) ? 3000 : 0)
    best.set(key, g0)
    parent.set(key, { start: s })
    heap.push({ f: g0 + h(s.q.x, s.q.y), g: g0, i, j, d, key })
  }

  let finish = null
  while (heap.size) {
    const cur = heap.pop()
    if (finish && cur.f >= finish.cost) break
    if (cur.g > (best.get(cur.key) ?? Infinity)) continue
    const node = cur.i * NY + cur.j
    // 도착 접점이면: 카드 쪽으로 들어가는 방향이 아니면 꺾임 비용
    for (const g of goalAt.get(node) ?? []) {
      if (cur.d === moveIndex(g.dir)) continue // 카드에서 멀어지며 도착 → U턴 필요, 제외
      const into = moveIndex({ x: -g.dir.x, y: -g.dir.y })
      const cost = cur.g + STUB + (cur.d === into ? 0 : BEND) + (onTimeline(g) ? 3000 : 0)
      if (!finish || cost < finish.cost) finish = { cost, key: cur.key, goal: g }
    }
    for (let d = 0; d < 4; d++) {
      const m = MOVES[d]
      if (m.x === -MOVES[cur.d].x && m.y === -MOVES[cur.d].y) continue // 되돌아가기 없음
      const ni = cur.i + m.x
      const nj = cur.j + m.y
      if (ni < 0 || nj < 0 || ni >= xs.length || nj >= NY) continue
      const x1 = xs[cur.i]
      const y1 = ys[cur.j]
      const x2 = xs[ni]
      const y2 = ys[nj]
      if (blocked(x2, y2) || blocked((x1 + x2) / 2, (y1 + y2) / 2)) continue
      let g = cur.g + Math.abs(x2 - x1) + Math.abs(y2 - y1) + (d === cur.d ? 0 : BEND)
      if (m.y === 0 && Math.abs(y1 - TIMELINE_Y) < 8) g += 3000 // 타임라인 선 위를 달리면 타임라인처럼 보임
      const key = (ni * NY + nj) * 4 + d
      if (g >= (best.get(key) ?? Infinity)) continue
      best.set(key, g)
      parent.set(key, { prev: cur.key })
      heap.push({ f: g + h(x2, y2), g, i: ni, j: nj, d, key })
    }
  }
  if (!finish) return null

  // 경로 복원
  const nodes = []
  let key = finish.key
  let start = null
  for (;;) {
    const node = Math.floor(key / 4)
    nodes.push({ x: xs[Math.floor(node / NY)], y: ys[node % NY] })
    const p = parent.get(key)
    if (p.start) { start = p.start; break }
    key = p.prev
  }
  nodes.reverse()
  return { pts: simplify([start.p, ...nodes, finish.goal.p]), sa: start.side, sb: finish.goal.side }
}

// 길이 없을 때(카드로 완전히 막힘): 아래 → 위 단순 경로
function fallback(A, B) {
  const s = port(A, 'bottom')
  const t = port(B, 'top')
  const midY = (s.q.y + t.q.y) / 2
  return { pts: simplify([s.p, s.q, { x: s.q.x, y: midY }, { x: t.q.x, y: midY }, t.q, t.p]), sa: 'bottom', sb: 'top' }
}

// 꺾임점 → 둥근 모서리 SVG 경로
export function roundedPath(pts) {
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [p, c, n] = [pts[i - 1], pts[i], pts[i + 1]]
    const r = Math.min(RADIUS, dist(p, c) / 2, dist(c, n) / 2)
    const toward = (from, to, len) => {
      const L = dist(from, to) || 1
      return { x: from.x + ((to.x - from.x) / L) * len, y: from.y + ((to.y - from.y) / L) * len }
    }
    const p1 = toward(c, p, r)
    const p2 = toward(c, n, r)
    d += ` L ${p1.x} ${p1.y} Q ${c.x} ${c.y} ${p2.x} ${p2.y}`
  }
  const last = pts[pts.length - 1]
  return `${d} L ${last.x} ${last.y}`
}

// 경로 길이의 절반 지점 (삭제 버튼 위치)
function midpoint(pts) {
  const total = pts.slice(1).reduce((s, q, i) => s + dist(pts[i], q), 0)
  let left = total / 2
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = dist(pts[i], pts[i + 1])
    if (left <= seg) {
      const t = seg ? left / seg : 0
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t }
    }
    left -= seg
  }
  return pts[0]
}

// 모든 관계선의 경로 계산
// edges: [{ id, sourceNodeId, targetNodeId }] / boxes: Map(nodeId → { x, y, w, h }) (배치된 카드만)
// 결과: Map(edgeId → { d, startHandle, endHandle, mid })
export function routeEdges(edges, boxes) {
  const all = [...boxes.entries()]
  const othersOf = (a, b) => all.filter(([id]) => id !== a && id !== b).map(([, box]) => box)

  // 1) 선마다 가장 좋은 경로 → 쓸 변 결정 (접점은 변 가운데)
  const chosen = edges
    .map((e) => {
      const A = boxes.get(e.sourceNodeId)
      const B = boxes.get(e.targetNodeId)
      if (!A || !B) return null
      const others = othersOf(e.sourceNodeId, e.targetNodeId)
      const r = search(A, B, others) ?? fallback(A, B)
      return { e, A, B, others, sa: r.sa, sb: r.sb, ta: 0.5, tb: 0.5 }
    })
    .filter(Boolean)

  // 2) 같은 카드·같은 변을 쓰는 선끼리 접점을 고르게 나눈다 (상대 노드 위치 순서대로 → 교차 줄이기)
  const uses = new Map()
  const center = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })
  for (const c of chosen) {
    for (const [nodeId, side, other, key] of [
      [c.e.sourceNodeId, c.sa, c.B, 'ta'],
      [c.e.targetNodeId, c.sb, c.A, 'tb'],
    ]) {
      const k = `${nodeId}:${side}`
      if (!uses.has(k)) uses.set(k, [])
      uses.get(k).push({ c, side, key, order: side === 'right' ? center(other).y : center(other).x })
    }
  }
  for (const list of uses.values()) {
    if (list.length < 2) continue
    list.sort((a, b) => a.order - b.order)
    const [lo, hi] = RANGE[list[0].side]
    list.forEach((u, i) => { u.c[u.key] = lo + ((hi - lo) * (i + 1)) / (list.length + 1) })
  }

  // 3) 위아래로 마주 보는 두 카드가 가로로 겹치면 접점을 같은 x에 맞춰 곧은 선으로 (그 변을 혼자 쓸 때만)
  for (const c of chosen) {
    const vertical = (s) => s === 'top' || s === 'bottom'
    if (!vertical(c.sa) || !vertical(c.sb) || c.sa === c.sb) continue
    if (uses.get(`${c.e.sourceNodeId}:${c.sa}`).length > 1 || uses.get(`${c.e.targetNodeId}:${c.sb}`).length > 1) continue
    const lo = Math.max(c.A.x + c.A.w * RANGE.top[0], c.B.x + c.B.w * RANGE.top[0])
    const hi = Math.min(c.A.x + c.A.w * RANGE.top[1], c.B.x + c.B.w * RANGE.top[1])
    if (lo <= hi) {
      const x = (lo + hi) / 2
      c.ta = (x - c.A.x) / c.A.w
      c.tb = (x - c.B.x) / c.B.w
    }
  }

  // 4) 정해진 변·접점으로 최종 경로 (안 되면 변을 다시 고름)
  const routes = new Map()
  for (const c of chosen) {
    const fixed = search(c.A, c.B, c.others, { sidesA: [c.sa], sidesB: [c.sb], tA: { [c.sa]: c.ta }, tB: { [c.sb]: c.tb } })
    const r = fixed ?? search(c.A, c.B, c.others) ?? fallback(c.A, c.B)
    const s = port(c.A, r.sa, fixed ? c.ta : 0.5)
    const t = port(c.B, r.sb, fixed ? c.tb : 0.5)
    routes.set(c.e.id, {
      d: roundedPath(r.pts),
      // 끝점 핸들: 카드에서 살짝 떨어진 곳 (카드·연결 핸들과 겹치지 않게)
      startHandle: s.q,
      endHandle: t.q,
      mid: midpoint(r.pts),
    })
  }
  return routes
}

// 미리보기: 두 카드 사이 (연결될 모습 그대로)
export function routeBetween(A, B, obstacles = []) {
  const r = search(A, B, obstacles) ?? fallback(A, B)
  return roundedPath(r.pts)
}

// 미리보기: 카드에서 마우스 위치까지 (마우스 쪽 변에서 출발)
export function routeToPoint(A, p) {
  const cy = A.y + A.h / 2
  const side = p.y > A.y + A.h ? 'bottom' : p.y < A.y ? 'top' : p.x > A.x + A.w ? 'right' : p.y >= cy ? 'bottom' : 'top'
  const { p: s } = port(A, side)
  const corner = side === 'right' ? { x: p.x, y: s.y } : { x: s.x, y: p.y }
  return roundedPath(simplify([s, corner, p]))
}

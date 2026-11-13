import { createContext } from 'react'
import { TIMELINE_Y, isPill } from './layout.js'

// 학기 가지선: 학기 타임라인에서 그 학기에 배치된 노드로 뻗는 회색 곡선
// - 노드 관계선(edges)과 데이터·동작이 분리되어 있다. 노드의 periodId(소속 학기)로 그린다.
// - 표시 여부 node.branchVisibility: null(자동) | 'shown'(표시) | 'hidden'(숨김)
//   자동 = 항상 표시 (관계선 유무와 무관)
// - 타임라인 선 위에 놓인 교과목은 이미 선 위에 있으므로 가지선이 없다.
// - 보관함(배치 안 됨) 노드는 그리지 않는다.

export const BRANCH_OPTIONS = [
  { value: null, label: '자동' },
  { value: 'shown', label: '표시' },
  { value: 'hidden', label: '숨김' },
]

// 자동 규칙: 학기에 배치된 활동은 관계선 유무와 상관없이 항상 가지선 표시
// (가지선과 관계선은 별개의 선이다. 관계선을 만들거나 지워도 가지선은 바뀌지 않는다)
export function autoBranchVisible() {
  return true
}

export function branchVisible(node, edges) {
  if (node.status !== 'placed') return false
  if (node.branchVisibility === 'shown') return true
  if (node.branchVisibility === 'hidden') return false
  return autoBranchVisible()
}

// 가지선 끝은 카드에 닿지 않는다: 카드 왼쪽의 완료 표시등(회색·노란 점, 카드 경계 ±7px)보다 32px 앞에서 멈춘다
// → 표시등과 가지선 끝 사이에 빈 공간이 보여서 카드와 이어진 선(관계선)처럼 보이지 않는다. 좌표는 그대로, 그리는 경로만
const DOT_R = 7 // 완료 표시등 반지름 (roadmap.css .rm-dot::after 14px)
const END_GAP = 32 // 표시등과 가지선 끝 사이 빈 공간
const MIN_RUN = 16 // 가지선 가로 부분 최소 길이
const TRUNK_GAP = DOT_R + END_GAP + MIN_RUN // 줄기와 카드 왼쪽 경계 사이 거리 (55)
const BADGE_CLEAR = 48 // 줄기는 학기 배지보다 오른쪽에서 시작
const BADGE_EDGE = 36 // 줄기가 이보다 왼쪽(배지 안)으로는 가지 않는다
const PILL_GAP = 16 // 타임라인 위 작은 카드와 줄기 사이 거리

// cards: [{ node, box }] 캔버스에 그려진 카드 (box는 지금 화면 위치. 드래그 중이면 드래그 위치)
// 결과: [{ id, d }]
export function computeBranches(cards, edges, layout) {
  const byPeriod = new Map()
  for (const c of cards) {
    if (!branchVisible(c.node, edges)) continue
    const onLine = isPill(c.node) && Math.abs(c.box.y + c.box.h / 2 - TIMELINE_Y) < 1
    if (onLine) continue
    if (!byPeriod.has(c.node.periodId)) byPeriod.set(c.node.periodId, [])
    byPeriod.get(c.node.periodId).push(c)
  }

  const branches = []
  for (const [periodId, list] of byPeriod) {
    const col = layout.cols[periodId]
    if (!col) continue
    // 학기 안 가지선들이 함께 쓰는 세로 줄기 (피그마처럼 한 줄기에서 갈라짐)
    let trunk = Math.max(col.x + BADGE_CLEAR, Math.min(...list.map((c) => c.box.x)) - TRUNK_GAP)
    // 타임라인 위 작은 카드 밑에서 줄기가 나오면 카드에서 나온 선처럼 보이므로, 카드 왼쪽으로 비켜 준다
    const pills = cards
      .filter((c) => c.node.periodId === periodId && isPill(c.node) && Math.abs(c.box.y + c.box.h / 2 - TIMELINE_Y) < 1)
      .sort((a, b) => b.box.x - a.box.x)
    for (const { box } of pills) {
      if (trunk > box.x - PILL_GAP && trunk < box.x + box.w + PILL_GAP) trunk = box.x - PILL_GAP
    }
    trunk = Math.max(trunk, col.x + BADGE_CLEAR)
    for (const { node, box } of list) {
      // 노드가 줄기에 너무 가까우면 그 노드만 따로 줄기를 둔다 (배지 안으로는 가지 않음)
      const x = box.x - trunk >= TRUNK_GAP ? trunk : Math.max(col.x + BADGE_EDGE, box.x - TRUNK_GAP)
      const tx = box.x - DOT_R - END_GAP // 가지선 끝: 표시등 앞 32px
      const ty = box.y + box.h / 2
      if (ty <= TIMELINE_Y) continue // 타임라인보다 위에 있는 노드(드물게)는 그리지 않음
      if (tx - x < 4) {
        // 카드가 학기 맨 왼쪽에 붙어 있어 가로로 뻗을 자리가 없으면: 세로 줄기만, 카드 높이 위쪽에서 멈춘다
        const end = Math.max(TIMELINE_Y, box.y - END_GAP)
        if (end > TIMELINE_Y) branches.push({ id: node.id, sx: x, d: `M ${x} ${TIMELINE_Y} L ${x} ${end}` })
        continue
      }
      const r = Math.max(0, Math.min(20, (ty - TIMELINE_Y) / 2, (tx - x) / 2))
      branches.push({ id: node.id, sx: x, d: `M ${x} ${TIMELINE_Y} L ${x} ${ty - r} Q ${x} ${ty} ${x + r} ${ty} L ${tx} ${ty}` })
    }
  }
  return branches
}

// 가지선 목록을 타임라인 배경에 전달 (노드 목록을 다시 만들지 않으려고 Context 사용)
export const BranchContext = createContext([])

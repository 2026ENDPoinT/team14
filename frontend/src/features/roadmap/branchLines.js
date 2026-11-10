import { createContext } from 'react'
import { TIMELINE_Y, isCourse } from './layout.js'

// 학기 가지선: 학기 타임라인에서 그 학기에 배치된 노드로 뻗는 회색 곡선
// - 노드 관계선(edges)과 데이터·동작이 분리되어 있다. 노드의 periodId(소속 학기)로 그린다.
// - 표시 여부 node.branchVisibility: null(자동) | 'shown'(표시) | 'hidden'(숨김)
//   자동 = 다른 노드에서 들어오는 관계선이 없으면 표시
// - 타임라인 선 위에 놓인 교과목은 이미 선 위에 있으므로 가지선이 없다.
// - 보관함(배치 안 됨) 노드는 그리지 않는다.

export const BRANCH_OPTIONS = [
  { value: null, label: '자동' },
  { value: 'shown', label: '표시' },
  { value: 'hidden', label: '숨김' },
]

// 자동 규칙: 들어오는 관계선이 없으면 가지선 표시
export function autoBranchVisible(nodeId, edges) {
  return !edges.some((e) => e.targetNodeId === nodeId)
}

export function branchVisible(node, edges) {
  if (node.status !== 'placed') return false
  if (node.branchVisibility === 'shown') return true
  if (node.branchVisibility === 'hidden') return false
  return autoBranchVisible(node.id, edges)
}

const TRUNK_GAP = 28 // 줄기와 노드 사이 거리
const BADGE_CLEAR = 48 // 줄기는 학기 배지보다 오른쪽에서 시작
const DOT_GAP = 12 // 노드 왼쪽 완료 표시등 앞에서 멈춘다 (표시등과 겹치지 않게)
const PILL_GAP = 16 // 타임라인 위 교과목 카드와 줄기 사이 거리

// cards: [{ node, box }] 캔버스에 그려진 카드 (box는 지금 화면 위치. 드래그 중이면 드래그 위치)
// 결과: [{ id, d }]
export function computeBranches(cards, edges, layout) {
  const byPeriod = new Map()
  for (const c of cards) {
    if (!branchVisible(c.node, edges)) continue
    const onLine = isCourse(c.node) && Math.abs(c.box.y + c.box.h / 2 - TIMELINE_Y) < 1
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
    // 타임라인 위 교과목 카드 밑에서 줄기가 나오면 카드에서 나온 선처럼 보이므로, 카드 왼쪽으로 비켜 준다
    const pills = cards
      .filter((c) => c.node.periodId === periodId && isCourse(c.node) && Math.abs(c.box.y + c.box.h / 2 - TIMELINE_Y) < 1)
      .sort((a, b) => b.box.x - a.box.x)
    for (const { box } of pills) {
      if (trunk > box.x - PILL_GAP && trunk < box.x + box.w + PILL_GAP) trunk = box.x - PILL_GAP
    }
    trunk = Math.max(trunk, col.x + BADGE_CLEAR)
    for (const { node, box } of list) {
      // 노드가 줄기에 너무 가까우면 그 노드만 따로 줄기를 둔다
      const x = box.x - trunk >= TRUNK_GAP ? trunk : box.x - TRUNK_GAP
      const tx = box.x - DOT_GAP
      const ty = box.y + box.h / 2
      if (ty <= TIMELINE_Y) continue // 타임라인보다 위에 있는 노드(드물게)는 그리지 않음
      const r = Math.max(0, Math.min(20, (ty - TIMELINE_Y) / 2, (tx - x) / 2))
      branches.push({ id: node.id, d: `M ${x} ${TIMELINE_Y} L ${x} ${ty - r} Q ${x} ${ty} ${x + r} ${ty} L ${tx} ${ty}` })
    }
  }
  return branches
}

// 가지선 목록을 타임라인 배경에 전달 (노드 목록을 다시 만들지 않으려고 Context 사용)
export const BranchContext = createContext([])

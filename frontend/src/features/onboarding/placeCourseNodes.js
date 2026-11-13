// 온보딩으로 학기에 들어간 교과목 노드의 화면 위치 계산
//
// complete_onboarding은 과목 노드를 학기(period)에만 넣고 위치는 기본값 (0, 0)으로 둔다.
// 그대로 두면 같은 학기 과목이 학기 칸 왼쪽 위 한 점에 겹친다.
// → 로드맵이 드래그·새 노드에 쓰는 배치 규칙(layout.js placeNode)으로, 학기 타임라인 선 위에
//   과목 순서(과목 키 = 연계도 위→아래 순서)대로 겹치지 않게 자리를 정한다.
// 결과는 moveNodes(services/api.js)에 그대로 넣는 [{ id, periodId, position }] 목록이다. (화면·DB 접근 없음)

import { COURSE_GAP, COURSE_START, TIMELINE_Y, cardSize, computeLayout, isCourse, placeNode } from '../roadmap/layout.js'

export function placeCourseNodes({ periods, nodes }) {
  const isTarget = (n) => isCourse(n) && n.status === 'placed' && n.periodId
  const targets = nodes
    .filter(isTarget)
    .sort((a, b) => a.originKey.localeCompare(b.originKey))
  // 아직 자리를 정하지 않은 과목은 장애물로 보지 않는다 (모두 (0, 0)에 겹쳐 있으므로)
  let placed = nodes.filter((n) => !isTarget(n))
  const moves = []

  for (const node of targets) {
    const layout = computeLayout(periods, placed)
    const col = layout.cols[node.periodId]
    if (!col) continue
    const { h } = cardSize(node)
    // 학기 시작점 오른쪽, 타임라인 선 위에 놓아 본다 (겹치면 placeNode가 선을 따라 빈자리를 찾는다)
    // 학기 선에서 COURSE_START 떨어진 곳부터, 과목 카드 사이는 COURSE_GAP으로 넉넉히 (불러올 때의 간격 맞추기와 같은 규칙)
    const spot = placeNode(node, { x: col.x + COURSE_START, y: TIMELINE_Y - h / 2 }, placed, layout, { gap: COURSE_GAP })
    if (!spot || spot.periodId !== node.periodId) continue // 자리를 못 찾으면 그대로 둔다
    moves.push({ id: node.id, periodId: spot.periodId, position: spot.position })
    placed = [...placed, { ...node, position: spot.position }]
  }
  return moves
}

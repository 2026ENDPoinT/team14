// 노드 관계선(edges) 규칙
// - 관계선은 "서로 관련 있음"을 뜻한다. 방향(선수과목 등)으로 해석하지 않으므로
//   A→B와 B→A는 같은 관계로 보고 중복으로 막는다.

// 같은 두 노드를 잇는 관계선이 이미 있는지 (ignoreEdgeId: 끝점을 옮기는 중인 선 자신은 제외)
export function hasEdgeBetween(edges, a, b, ignoreEdgeId = null) {
  return edges.some(
    (e) =>
      e.id !== ignoreEdgeId &&
      ((e.sourceNodeId === a && e.targetNodeId === b) || (e.sourceNodeId === b && e.targetNodeId === a)),
  )
}

// 연결할 수 없으면 이유(안내 문구), 연결할 수 있으면 null
export function linkProblem(edges, sourceId, targetId, ignoreEdgeId = null) {
  if (sourceId === targetId) return '자기 자신과는 연결할 수 없어요.'
  if (hasEdgeBetween(edges, sourceId, targetId, ignoreEdgeId)) return '이미 연결된 노드예요.'
  return null
}

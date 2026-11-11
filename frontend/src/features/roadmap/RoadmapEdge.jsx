import { CloseIcon } from './icons.jsx'

// React Flow 사용자 정의 연결선 (노드 관계선).
// 경로는 캔버스에서 모든 선을 함께 계산해 data.route로 받는다. (edgeRouting.js)
// 선에 마우스를 올리면(CSS :hover) 양 끝 핸들과 삭제 버튼이 나타난다.
// 끝 핸들을 끌어 다른 노드에 놓으면 연결 대상이 바뀐다. (useLinkDrag)
export default function RoadmapEdge({ id, data }) {
  const route = data.route
  if (!route) return null // 한쪽 노드가 보관함에 있으면 그리지 않는다

  const { d, startHandle, endHandle, mid } = route
  // 끝점 핸들을 누르면 그 끝을 다른 노드로 옮길 수 있다 (nopan: 캔버스 이동 방지)
  const grip = (pos, which) => (
    <g className="rm-edge__end nopan" onPointerDown={(e) => data.onStartReconnect(e, which)}>
      <circle className="rm-edge__grip" cx={pos.x} cy={pos.y} r="11" />
      <circle className="rm-edge__handle" cx={pos.x} cy={pos.y} r="6" />
    </g>
  )
  return (
    <>
      <path className="rm-edge__hit" d={d} />
      {/* style.d: 학기가 넓어져 노드가 옆으로 미끄러질 때 선도 같이 움직이게 (CSS 애니메이션용) */}
      <path className="rm-edge__line" d={d} style={{ d: `path("${d}")` }} />
      <g className="rm-edge__controls">
        {grip(startHandle, 'source')}
        {grip(endHandle, 'target')}
        <g
          className="rm-edge__delete"
          transform={`translate(${mid.x} ${mid.y})`}
          onClick={() => data.onDelete(id)}
          role="button"
          aria-label="연결선 삭제"
        >
          <circle r="14" />
          <CloseIcon x="-7" y="-7" width="14" height="14" strokeWidth="2.4" />
        </g>
      </g>
    </>
  )
}

import { useInternalNode } from '@xyflow/react'
import { CloseIcon } from './icons.jsx'

const OUT = 22 // 끝점 핸들을 노드 왼쪽 점(완료 표시등)에서 이만큼 떨어뜨린다

// 연결선 경로 계산: 세로 줄기를 따라 내려와 도착 노드 왼쪽 점으로 꺾여 들어간다
// inset: 노드 왼쪽 점(완료 표시등)에 닿기 전에 선을 이만큼 일찍 끝낸다 (표시등 클릭을 가리지 않게)
// startHandle·endHandle: 끝점을 옮기는 핸들 위치 (표시등·다른 선의 핸들과 겹치지 않는 곳)
function edgePath(a, b, inset = 0) {
  const tx = b.x
  const ty = b.y + b.h / 2
  const r = 24 // 모서리 둥글기

  // 도착 노드가 아래쪽에 있을 때: 둥근 직각 꺾은선
  if (ty - (a.y + a.h) > r) {
    let trunk = Math.min(a.x + 50, tx - 40) // 세로 줄기의 x 위치
    if (trunk >= a.x + 20) {
      // 출발 노드 아래쪽에서 바로 내려감
      const sy = a.y + a.h
      const d = `M ${trunk} ${sy} V ${ty - r} Q ${trunk} ${ty} ${trunk + r} ${ty} H ${tx - inset}`
      return { d, mid: [trunk, (sy + ty) / 2], startHandle: [trunk, sy], endHandle: [tx - OUT, ty] }
    }
    // 도착 노드가 더 왼쪽이면: 출발 노드 왼쪽 점에서 나와 왼쪽 줄기로 내려감
    trunk = Math.min(a.x - 30, tx - 40)
    const sy = a.y + a.h / 2
    const c = 14
    const d = `M ${a.x - inset} ${sy} H ${trunk + c} Q ${trunk} ${sy} ${trunk} ${sy + c} V ${ty - c} Q ${trunk} ${ty} ${trunk + c} ${ty} H ${tx - inset}`
    // 출발 핸들은 세로 줄기 위에 둔다 (같은 노드 왼쪽으로 들어오는 다른 선의 핸들과 겹치지 않게)
    return { d, mid: [trunk, (sy + ty) / 2], startHandle: [trunk, sy + c + 10], endHandle: [tx - OUT, ty] }
  }
  // 그 밖의 경우(옆이나 위): 부드러운 곡선
  const ex = a.x + a.w
  const ey = a.y + a.h / 2
  const d = `M ${ex} ${ey} C ${ex + 80} ${ey}, ${tx - 80} ${ty}, ${tx - inset} ${ty}`
  return { d, mid: [(ex + tx) / 2, (ey + ty) / 2], startHandle: [ex + OUT, ey], endHandle: [tx - OUT, ty] }
}

// React Flow가 계산한 노드의 캔버스 위치·크기
function boxOf(internalNode) {
  const { x, y } = internalNode.internals.positionAbsolute
  const { width = 0, height = 0 } = internalNode.measured
  return { x, y, w: width, h: height }
}

// React Flow 사용자 정의 연결선 (노드 관계선).
// 선에 마우스를 올리면(CSS :hover) 양 끝 핸들과 삭제 버튼이 나타난다.
// 끝 핸들을 끌어 다른 노드에 놓으면 연결 대상이 바뀐다. (useLinkDrag)
export default function RoadmapEdge({ id, source, target, data }) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  if (!sourceNode?.measured.width || !targetNode?.measured.width) return null

  const a = boxOf(sourceNode)
  const b = boxOf(targetNode)
  const { d, mid, startHandle, endHandle } = edgePath(a, b, 7) // 보이는 선: 점의 가장자리에서 끝
  const hit = edgePath(a, b, 14).d // 마우스 감지 영역: 점(24px 클릭 영역)과 겹치지 않게
  // 끝점 핸들을 누르면 그 끝을 다른 노드로 옮길 수 있다 (nopan: 캔버스 이동 방지)
  const grip = (pos, which) => (
    <g className="rm-edge__end nopan" onPointerDown={(e) => data.onStartReconnect(e, which)}>
      <circle className="rm-edge__grip" cx={pos[0]} cy={pos[1]} r="11" />
      <circle className="rm-edge__handle" cx={pos[0]} cy={pos[1]} r="6" />
    </g>
  )
  return (
    <>
      <path className="rm-edge__hit" d={hit} />
      {/* style.d: 학기가 넓어져 노드가 옆으로 미끄러질 때 선도 같이 움직이게 (CSS 애니메이션용) */}
      <path className="rm-edge__line" d={d} style={{ d: `path("${d}")` }} />
      <g className="rm-edge__controls">
        {grip(startHandle, 'source')}
        {grip(endHandle, 'target')}
        <g
          className="rm-edge__delete"
          transform={`translate(${mid[0]} ${mid[1]})`}
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

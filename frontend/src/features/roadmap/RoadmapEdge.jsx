import { useInternalNode } from '@xyflow/react'
import { CloseIcon } from './icons.jsx'

// 연결선 경로 계산: 세로 줄기를 따라 내려와 도착 노드 왼쪽 점으로 꺾여 들어간다
// inset: 노드 왼쪽 점(완료 표시등)에 닿기 전에 선을 이만큼 일찍 끝낸다 (표시등 클릭을 가리지 않게)
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
      return { d, start: [trunk, sy], end: [tx, ty], mid: [trunk, (sy + ty) / 2] }
    }
    // 도착 노드가 더 왼쪽이면: 출발 노드 왼쪽 점에서 나와 왼쪽 줄기로 내려감
    trunk = Math.min(a.x - 30, tx - 40)
    const sy = a.y + a.h / 2
    const c = 14
    const d = `M ${a.x - inset} ${sy} H ${trunk + c} Q ${trunk} ${sy} ${trunk} ${sy + c} V ${ty - c} Q ${trunk} ${ty} ${trunk + c} ${ty} H ${tx - inset}`
    return { d, start: [a.x, sy], end: [tx, ty], mid: [trunk, (sy + ty) / 2] }
  }
  // 그 밖의 경우(옆이나 위): 부드러운 곡선
  const ex = a.x + a.w
  const ey = a.y + a.h / 2
  const d = `M ${ex} ${ey} C ${ex + 80} ${ey}, ${tx - 80} ${ty}, ${tx - inset} ${ty}`
  return { d, start: [ex, ey], end: [tx, ty], mid: [(ex + tx) / 2, (ey + ty) / 2] }
}

// React Flow가 계산한 노드의 캔버스 위치·크기
function boxOf(internalNode) {
  const { x, y } = internalNode.internals.positionAbsolute
  const { width = 0, height = 0 } = internalNode.measured
  return { x, y, w: width, h: height }
}

// React Flow 사용자 정의 연결선.
// 선에 마우스를 올리면(CSS :hover) 양 끝 핸들과 삭제 버튼이 나타난다.
export default function RoadmapEdge({ id, source, target, data }) {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)
  if (!sourceNode?.measured.width || !targetNode?.measured.width) return null

  const a = boxOf(sourceNode)
  const b = boxOf(targetNode)
  const { d, start, end, mid } = edgePath(a, b, 7) // 보이는 선: 점의 가장자리에서 끝
  const hit = edgePath(a, b, 14).d // 마우스 감지 영역: 점(24px 클릭 영역)과 겹치지 않게
  return (
    <>
      <path className="rm-edge__hit" d={hit} />
      <path className="rm-edge__line" d={d} />
      <g className="rm-edge__controls">
        <circle className="rm-edge__handle" cx={start[0]} cy={start[1]} r="6" />
        <circle className="rm-edge__handle" cx={end[0]} cy={end[1]} r="6" />
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

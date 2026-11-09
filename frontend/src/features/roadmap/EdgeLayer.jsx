import { nodeBox } from './layout.js'
import { CloseIcon } from './icons.jsx'

// 연결선 경로 계산: 세로 줄기를 따라 내려와 도착 노드 왼쪽 점으로 꺾여 들어간다
function edgePath(a, b) {
  const tx = b.x
  const ty = b.y + b.h / 2
  const r = 24 // 모서리 둥글기

  // 도착 노드가 아래쪽에 있을 때: 둥근 직각 꺾은선
  if (ty - (a.y + a.h) > r) {
    let trunk = Math.min(a.x + 50, tx - 40) // 세로 줄기의 x 위치
    if (trunk >= a.x + 20) {
      // 출발 노드 아래쪽에서 바로 내려감
      const sy = a.y + a.h
      const d = `M ${trunk} ${sy} V ${ty - r} Q ${trunk} ${ty} ${trunk + r} ${ty} H ${tx}`
      return { d, start: [trunk, sy], end: [tx, ty], mid: [trunk, (sy + ty) / 2] }
    }
    // 도착 노드가 더 왼쪽이면: 출발 노드 왼쪽 점에서 나와 왼쪽 줄기로 내려감
    trunk = Math.min(a.x - 30, tx - 40)
    const sy = a.y + a.h / 2
    const c = 14
    const d = `M ${a.x} ${sy} H ${trunk + c} Q ${trunk} ${sy} ${trunk} ${sy + c} V ${ty - c} Q ${trunk} ${ty} ${trunk + c} ${ty} H ${tx}`
    return { d, start: [a.x, sy], end: [tx, ty], mid: [trunk, (sy + ty) / 2] }
  }
  // 그 밖의 경우(옆이나 위): 부드러운 곡선
  const ex = a.x + a.w
  const ey = a.y + a.h / 2
  const d = `M ${ex} ${ey} C ${ex + 80} ${ey}, ${tx - 80} ${ty}, ${tx} ${ty}`
  return { d, start: [ex, ey], end: [tx, ty], mid: [(ex + tx) / 2, (ey + ty) / 2] }
}

// 연결선 레이어. 선에 마우스를 올리면(CSS :hover) 양 끝 핸들과 삭제 버튼이 나타난다.
export default function EdgeLayer({ edges, nodes, periods, width, height, onDelete }) {
  return (
    <svg className="rm-edges" width={width} height={height}>
      {edges.map((edge) => {
        const source = nodes.find((n) => n.id === edge.sourceNodeId)
        const target = nodes.find((n) => n.id === edge.targetNodeId)
        const a = source && nodeBox(source, periods)
        const b = target && nodeBox(target, periods)
        if (!a || !b) return null // 보관함에 있는 노드의 선은 그리지 않는다

        const { d, start, end, mid } = edgePath(a, b)
        return (
          <g key={edge.id} className="rm-edge">
            <path className="rm-edge__hit" d={d} />
            <path className="rm-edge__line" d={d} />
            <g className="rm-edge__controls">
              <circle className="rm-edge__handle" cx={start[0]} cy={start[1]} r="6" />
              <circle className="rm-edge__handle" cx={end[0]} cy={end[1]} r="6" />
              <g
                className="rm-edge__delete"
                transform={`translate(${mid[0]} ${mid[1]})`}
                onClick={() => onDelete(edge.id)}
                role="button"
                aria-label="연결선 삭제"
              >
                <circle r="14" />
                <CloseIcon x="-7" y="-7" width="14" height="14" strokeWidth="2.4" />
              </g>
            </g>
          </g>
        )
      })}
    </svg>
  )
}

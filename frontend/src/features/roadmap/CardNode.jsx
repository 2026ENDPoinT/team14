import { Handle, Position } from '@xyflow/react'
import NodeCard from './NodeCard.jsx'
import { cardSize } from './layout.js'

// React Flow에 올리는 노드 카드.
// Handle은 React Flow가 연결선을 그리기 위해 필요한 연결점이다. (지금은 숨김, 연결 기능은 다음 단계)
export default function CardNode({ data }) {
  const { node, subtitle, onClick } = data
  const { w, h } = cardSize(node)
  return (
    <>
      <Handle type="target" position={Position.Left} className="rm-handle" isConnectable={false} />
      <NodeCard node={node} subtitle={subtitle} onClick={onClick} style={{ width: w, height: h }} />
      <Handle type="source" position={Position.Bottom} className="rm-handle" isConnectable={false} />
    </>
  )
}

import { Handle, Position } from '@xyflow/react'
import NodeCard from './NodeCard.jsx'
import { cardSize } from './layout.js'

// React Flow에 올리는 노드 카드 + 완료 상태 표시등.
// Handle은 React Flow가 연결선을 그리기 위해 필요한 연결점이다. (숨김. 완료 표시등과는 별개)
export default function CardNode({ data }) {
  const { node, subtitle, onClick, onToggleComplete } = data
  const { w, h } = cardSize(node)
  return (
    <>
      <Handle type="target" position={Position.Left} className="rm-handle" isConnectable={false} />
      <NodeCard node={node} subtitle={subtitle} onClick={onClick} hideDot style={{ width: w, height: h }} />
      <CompleteDot done={Boolean(node.completed)} title={node.title} onToggle={() => onToggleComplete(node.id)} />
      <Handle type="source" position={Position.Bottom} className="rm-handle" isConnectable={false} />
    </>
  )
}

// 완료 상태 표시등: 누르면 완료/미완료 전환
// - nodrag: React Flow가 이 버튼에서 노드 드래그를 시작하지 않게 하는 약속된 클래스
// - 카드 버튼과 형제 요소라서 눌러도 상세 창이 열리지 않는다
function CompleteDot({ done, title, onToggle }) {
  return (
    <button
      type="button"
      className={`rm-dot nodrag ${done ? 'is-done' : ''}`}
      aria-pressed={done}
      aria-label={`${title}: ${done ? '완료됨. 누르면 미완료로 변경' : '미완료. 누르면 완료로 변경'}`}
      title={done ? '완료' : '미완료'}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    />
  )
}

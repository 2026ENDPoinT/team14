import { useContext } from 'react'
import { Handle, Position } from '@xyflow/react'
import NodeCard from './NodeCard.jsx'
import { cardSize } from './layout.js'
import { LinkContext } from './linkContext.js'

// React Flow에 올리는 노드 카드 + 완료 상태 표시등.
// Handle은 React Flow가 연결선을 그리기 위해 필요한 연결점이다. (숨김. 완료 표시등과는 별개)
export default function CardNode({ data }) {
  const { node, subtitle, onClick, onToggleComplete } = data
  const { w, h } = cardSize(node)
  const { connectMode, startConnect, startConnectDrag, target } = useContext(LinkContext)
  // 관계선을 끄는 중 이 카드 위에 있으면 강조 (연결 가능 / 불가)
  const isTarget = target?.id === node.id
  const linkClass = [
    isTarget ? `is-link-target ${target.valid ? 'is-valid' : 'is-invalid'}` : '',
    isTarget && target.drop ? 'is-drop' : '', // 일반 드래그 연결 후보: 은은한 강조
    connectMode ? 'nodrag' : '', // CONNECT 모드: 카드를 끌면 이동 대신 관계선 그리기 (클릭은 그대로)
  ].join(' ')
  return (
    <>
      <Handle type="target" position={Position.Left} className="rm-handle" isConnectable={false} />
      <NodeCard
        node={node}
        subtitle={subtitle}
        onClick={onClick}
        hideDot
        className={linkClass}
        style={{ width: w, height: h }}
        onPointerDown={connectMode ? (e) => startConnectDrag(e, node.id) : undefined}
      />
      <CompleteDot done={Boolean(node.completed)} title={node.title} onToggle={() => onToggleComplete(node.id)} />
      {/* 타임라인 위 카드를 끌어 이 카드 위에 올렸을 때: 놓으면 자리가 바뀐다는 안내 */}
      {isTarget && target.swap && (
        <span className="rm-link-label" aria-hidden="true">자리 바꾸기</span>
      )}
      {/* 일반 드래그로 이 카드 위에 올렸을 때: 놓으면 관계선으로 이어진다는 안내 (이미 연결이면 회색) */}
      {isTarget && target.drop && (
        <span className={`rm-link-label ${target.valid ? '' : 'is-invalid'}`} aria-hidden="true">
          {target.valid ? '놓으면 연결' : '이미 연결됨'}
        </span>
      )}
      {/* 관계선 연결 핸들: CONNECT 모드에서만, 카드 오른쪽 (왼쪽 완료 표시등과 분리) */}
      {connectMode && (
        <button
          type="button"
          className="rm-link-handle nodrag nopan"
          aria-label={`${node.title}에서 관계선 연결하기`}
          title="끌어서 다른 활동에 놓으면 연결돼요"
          onPointerDown={(e) => startConnect(e, node.id)}
        />
      )}
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
      title={done ? '완료됨 · 누르면 미완료로' : '완료로 표시'}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    />
  )
}

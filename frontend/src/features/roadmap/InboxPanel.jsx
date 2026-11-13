import { createPortal } from 'react-dom'
import NodeCard from './NodeCard.jsx'
import usePresence from './usePresence.js'
import useInboxDrag from './useInboxDrag.js'
import { CloseIcon, PlusIcon } from './icons.jsx'
import { cardSize } from './layout.js'

// 노드 보관함 (MY NODE). INBOX를 눌렀을 때만 아래에서 올라온다.
// 카드를 캔버스로 끌어다 놓으면 해당 학기에 배치된다.
// allNodes·layout: 놓을 자리 계산(학기 판정·겹침 보정)에 필요
// onDelete: 카드 오른쪽 위 X 버튼 → 그 노드만 삭제
export default function InboxPanel({
  open, nodes, allNodes, layout, getSubtitle, onNodeClick, onAdd, onPlace, onTargetChange, onDelete,
}) {
  const { mounted, visible } = usePresence(open)
  const { ghost, startDrag, wasDragged, returnMs } = useInboxDrag({
    nodes: allNodes, layout, onPlace, onTargetChange,
  })
  if (!mounted) return null

  // 드래그 직후의 클릭은 상세 창을 열지 않는다
  const handleClick = (id) => {
    if (!wasDragged()) onNodeClick(id)
  }

  return (
    <section className={`rm-inbox ${visible ? 'is-visible' : ''}`} aria-label="보관함">
      <h2 className="rm-inbox__title">보관함</h2>
      <div className="rm-inbox__list">
        {nodes.length === 0 && (
          <p className="rm-inbox__empty">
            보관함이 비어 있어요. 학기를 아직 정하지 않은 활동을 여기 모아 두고, 나중에 캔버스로 끌어 배치할 수 있어요.
          </p>
        )}
        {nodes.map((node) => (
          <div key={node.id} className="rm-inbox__item">
            <NodeCard
              node={node}
              small
              className={`rm-inbox__card ${ghost?.node.id === node.id ? 'is-drag-source' : ''}`}
              subtitle={getSubtitle(node.id)}
              onClick={handleClick}
              onPointerDown={(e) => startDrag(e, node)}
            />
            {/* 카드(button) 안에 버튼을 넣을 수 없어 옆에 두고 위치만 겹친다. 드래그·상세 창이 시작되지 않게 이벤트를 막는다 */}
            <button
              type="button"
              className="rm-inbox__delete"
              aria-label={`'${node.title}' 활동 삭제`}
              title="삭제"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onDelete(node.id)
              }}
            >
              <CloseIcon width="10" height="10" strokeWidth="2.4" />
            </button>
          </div>
        ))}
        <button type="button" className="rm-inbox__add" aria-label="보관함에 활동 추가" title="활동 추가" onClick={onAdd}>
          <PlusIcon width="18" height="18" />
        </button>
      </div>

      {/* 드래그 미리보기: 보관함 패널 밖(페이지 전체 기준)에 그린다 */}
      {ghost && createPortal(<DragGhost ghost={ghost} subtitle={getSubtitle(ghost.node.id)} returnMs={returnMs} />,
        document.querySelector('.roadmap-page'))}
    </section>
  )
}

// 캔버스 배율에 맞춘 크기로 마우스를 따라다니는 카드
function DragGhost({ ghost, subtitle, returnMs }) {
  const { w, h } = cardSize(ghost.node)
  return (
    <div
      className={`rm-ghost ${ghost.returning ? 'is-returning' : ''}`}
      style={{
        transform: `translate(${ghost.x}px, ${ghost.y}px) scale(${ghost.zoom})`,
        transitionDuration: ghost.returning ? `${returnMs}ms` : '0ms',
      }}
    >
      <NodeCard node={ghost.node} subtitle={subtitle} style={{ width: w, height: h }} />
    </div>
  )
}

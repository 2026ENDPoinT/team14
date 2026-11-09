import { createPortal } from 'react-dom'
import NodeCard from './NodeCard.jsx'
import usePresence from './usePresence.js'
import useInboxDrag from './useInboxDrag.js'
import { PlusIcon } from './icons.jsx'
import { cardSize } from './layout.js'

// 노드 보관함 (MY NODE). INBOX를 눌렀을 때만 아래에서 올라온다.
// 카드를 캔버스로 끌어다 놓으면 해당 학기에 배치된다.
// allNodes·periods: 놓을 자리 계산(학기 판정·겹침 보정)에 필요
export default function InboxPanel({
  open, nodes, allNodes, periods, getSubtitle, onNodeClick, onAdd, onPlace, onTargetChange,
}) {
  const { mounted, visible } = usePresence(open)
  const { ghost, startDrag, wasDragged, returnMs } = useInboxDrag({
    nodes: allNodes, periods, onPlace, onTargetChange,
  })
  if (!mounted) return null

  // 드래그 직후의 클릭은 상세 창을 열지 않는다
  const handleClick = (id) => {
    if (!wasDragged()) onNodeClick(id)
  }

  return (
    <section className={`rm-inbox ${visible ? 'is-visible' : ''}`} aria-label="노드 보관함">
      <h2 className="rm-inbox__title">MY NODE</h2>
      <div className="rm-inbox__list">
        {nodes.length === 0 && <p className="rm-inbox__empty">보관함이 비어 있어요.</p>}
        {nodes.map((node) => (
          <NodeCard
            key={node.id}
            node={node}
            small
            className={`rm-inbox__card ${ghost?.node.id === node.id ? 'is-drag-source' : ''}`}
            subtitle={getSubtitle(node.id)}
            onClick={handleClick}
            onPointerDown={(e) => startDrag(e, node)}
          />
        ))}
        <button type="button" className="rm-inbox__add" aria-label="보관함에 노드 추가" onClick={onAdd}>
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

import NodeCard from './NodeCard.jsx'
import usePresence from './usePresence.js'
import { PlusIcon } from './icons.jsx'

// 노드 보관함 (MY NODE). INBOX를 눌렀을 때만 아래에서 올라온다.
export default function InboxPanel({ open, nodes, getSubtitle, onNodeClick, onAdd }) {
  const { mounted, visible } = usePresence(open)
  if (!mounted) return null

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
            subtitle={getSubtitle(node.id)}
            onClick={onNodeClick}
          />
        ))}
        <button type="button" className="rm-inbox__add" aria-label="보관함에 노드 추가" onClick={onAdd}>
          <PlusIcon width="18" height="18" />
        </button>
      </div>
    </section>
  )
}

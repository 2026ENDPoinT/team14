import { useEffect, useRef } from 'react'
import { ConnectIcon, NodeIcon, PlusIcon, SemesterIcon } from './icons.jsx'

const ITEMS = [
  { id: 'node', label: 'NODE', Icon: NodeIcon },
  { id: 'connect', label: 'CONNECT', Icon: ConnectIcon },
  { id: 'semester', label: 'SEMESTER', Icon: SemesterIcon },
]

// 오른쪽 아래 + 버튼과 INBOX 버튼.
// + 버튼을 눌렀을 때만 NODE / CONNECT / SEMESTER 메뉴가 펼쳐진다.
export default function FabMenu({ open, onToggle, onClose, onSelect, inboxOpen, onInboxClick }) {
  const ref = useRef(null)

  // 메뉴 바깥을 클릭하면 닫기
  useEffect(() => {
    if (!open) return
    const handle = (e) => {
      if (!ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open, onClose])

  return (
    <div className={`rm-fab ${open ? 'is-open' : ''}`} ref={ref}>
      <ul className="rm-fab__menu" aria-hidden={!open}>
        {ITEMS.map(({ id, label, Icon }, i) => (
          <li key={id} style={{ '--i': ITEMS.length - 1 - i }}>
            <button
              type="button"
              className="rm-fab__item"
              tabIndex={open ? 0 : -1}
              onClick={() => onSelect(id)}
            >
              <span className="rm-fab__label">{label}</span>
              <span className="rm-fab__icon"><Icon /></span>
            </button>
          </li>
        ))}
      </ul>

      <div className="rm-fab__bottom">
        <button
          type="button"
          className={`rm-inbox-btn ${inboxOpen ? 'is-active' : ''}`}
          onClick={onInboxClick}
        >
          INBOX
        </button>
        <button
          type="button"
          className="rm-fab__main"
          aria-label={open ? '메뉴 닫기' : '추가 메뉴 열기'}
          aria-expanded={open}
          onClick={onToggle}
        >
          <PlusIcon width="28" height="28" strokeWidth="1.6" />
        </button>
      </div>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { ConnectIcon, NodeIcon, PlusIcon, SemesterIcon } from './icons.jsx'

const ITEMS = [
  { id: 'node', label: '활동 추가', hint: '학기나 보관함에 새 활동을 만들어요', Icon: NodeIcon },
  { id: 'connect', label: '연결 모드', hint: '활동은 그대로 두고 관계선만 이어요', Icon: ConnectIcon },
  { id: 'semester', label: '학기 추가', hint: '휴학·군휴학·교환학생을 타임라인에 넣어요', Icon: SemesterIcon },
]

// 오른쪽 아래 + 버튼과 보관함 버튼.
// + 버튼을 눌렀을 때만 활동 추가 / 연결 모드 / 학기 추가 메뉴가 펼쳐진다.
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
        {ITEMS.map(({ id, label, hint, Icon }, i) => (
          <li key={id} style={{ '--i': ITEMS.length - 1 - i }}>
            <button
              type="button"
              className="rm-fab__item"
              tabIndex={open ? 0 : -1}
              onClick={() => onSelect(id)}
              title={hint}
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
          aria-expanded={inboxOpen}
          title="학기를 아직 정하지 않은 활동 모음"
        >
          보관함
        </button>
        <button
          type="button"
          className="rm-fab__main"
          aria-label={open ? '메뉴 닫기' : '활동 추가·연결 모드 메뉴 열기'}
          title={open ? '메뉴 닫기' : '활동 추가 · 연결 모드'}
          aria-expanded={open}
          onClick={onToggle}
        >
          <PlusIcon width="28" height="28" strokeWidth="1.6" />
        </button>
      </div>
    </div>
  )
}

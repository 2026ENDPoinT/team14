import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { CloseIcon } from './icons.jsx'
import { THEMES } from './layout.js'

const INBOX = 'inbox'

// 노드 생성 창. + 메뉴의 NODE 또는 보관함의 + 버튼을 눌렀을 때만 열린다.
export default function AddNodeModal({ open, periods, onClose, onCreate }) {
  const [theme, setTheme] = useState('project')
  const [title, setTitle] = useState('')
  const [destination, setDestination] = useState(INBOX)
  const [memo, setMemo] = useState('')

  // 열 때마다 입력값 초기화
  useEffect(() => {
    if (open) {
      setTheme('project')
      setTitle('')
      setDestination(INBOX)
      setMemo('')
    }
  }, [open])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onCreate({
      theme,
      title: title.trim(),
      periodId: destination === INBOX ? null : destination,
      memo: memo.trim(),
    })
  }

  return (
    <Modal open={open} onClose={onClose} label="노드 추가">
      <form className="rm-form" onSubmit={handleSubmit}>
        <header className="rm-modal__head">
          <div>
            <p className="rm-eyebrow">CREATE NEW</p>
            <h2 className="rm-modal__title">ADD NODE</h2>
          </div>
          <button type="button" className="rm-icon-btn" aria-label="닫기" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <hr className="rm-divider" />

        <label className="rm-field">
          <span className="rm-eyebrow">NODE TYPE</span>
          <select className="rm-input rm-select" value={theme} onChange={(e) => setTheme(e.target.value)}>
            {THEMES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </label>

        <label className="rm-field">
          <span className="rm-eyebrow">NODE NAME</span>
          <input
            className="rm-input"
            placeholder="노드 이름을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </label>

        <label className="rm-field">
          <span className="rm-eyebrow">DESTINATION</span>
          <select
            className="rm-input rm-select"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          >
            <option value={INBOX}>INBOX (나중에 배치)</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        <label className="rm-field">
          <span className="rm-eyebrow">SHORT NOTE</span>
          <textarea
            className="rm-input rm-textarea"
            placeholder="간단한 메모 (선택)"
            rows={3}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </label>

        <button type="submit" className="rm-primary-btn" disabled={!title.trim()}>
          CREATE NODE
        </button>
      </form>
    </Modal>
  )
}

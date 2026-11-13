import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { CloseIcon } from './icons.jsx'
import { MEMO_COLORS } from './MemoNode.jsx'
import './memo.css'

const SWATCH = { butter: '#f6e3a8', sage: '#b9cdb3', pink: '#f0c9c6', white: '#ffffff' }

// 메모 추가 창: 학기 · 제목(선택) · 내용 · 색
// onCreate({ periodId, title, body, color }) → 오류 문구 또는 null (성공하면 부모가 창을 닫는다)
export default function MemoCreateModal({ open, periods, onClose, onCreate }) {
  const [periodId, setPeriodId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [color, setColor] = useState('butter')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setPeriodId(periods[0]?.id ?? '')
      setTitle('')
      setBody('')
      setColor('butter')
      setSaving(false)
      setError('')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault()
    if (!periodId || !body.trim() || saving) return
    setSaving(true)
    setError('')
    const problem = await onCreate({ periodId, title, body, color })
    setSaving(false)
    if (problem) setError(problem)
  }

  return (
    <Modal open={open} onClose={onClose} label="메모 추가">
      <form className="rm-form" onSubmit={handleSubmit}>
        <header className="rm-modal__head">
          <div>
            <p className="rm-eyebrow">새로 만들기</p>
            <h2 className="rm-modal__title">메모 추가</h2>
          </div>
          <button type="button" className="rm-icon-btn" aria-label="닫기" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <hr className="rm-divider" />

        <label className="rm-field">
          <span className="rm-eyebrow">놓을 학기</span>
          <select className="rm-input" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="rm-field">
          <span className="rm-eyebrow">제목 (선택)</span>
          <input className="rm-input" value={title} maxLength={40} placeholder="예: 이번 학기 다짐" onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="rm-field">
          <span className="rm-eyebrow">메모</span>
          <textarea className="rm-input rm-textarea" rows={4} value={body} placeholder="캔버스에 늘 보일 메모를 적어 보세요" onChange={(e) => setBody(e.target.value)} />
        </label>
        <div className="rm-field">
          <span className="rm-eyebrow">색</span>
          <div className="rm-memo-colors" role="radiogroup" aria-label="메모 색">
            {MEMO_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={color === c.id}
                className={`rm-memo-color ${color === c.id ? 'is-on' : ''}`}
                onClick={() => setColor(c.id)}
              >
                <i style={{ background: SWATCH[c.id] }} />
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="rm-field-note is-error" role="alert">{error}</p>}
        <button type="submit" className="rm-primary-btn" disabled={!periodId || !body.trim() || saving}>
          {saving ? '저장하는 중…' : '메모 붙이기'}
        </button>
      </form>
    </Modal>
  )
}

import { useEffect, useState } from 'react'
import Modal from '../roadmap/Modal.jsx'
import { CloseIcon } from '../roadmap/icons.jsx'

// 탐색 공고를 로드맵에 바로 놓을 학기 고르기 (작은 창)
// - periods: 내 로드맵의 학기 목록 그대로 (휴학·교환·초과학기 등 직접 추가한 학기 포함)
// - 지금 학기는 프로필로 확실히 알 수 없어 미리 고르지 않는다 → 사용자가 직접 고른다
// - onConfirm(periodId) → 오류 문구 또는 null (성공하면 부모가 창을 닫는다)
export default function PlacePeriodModal({ open, title, periods, loading, loadError, onClose, onConfirm }) {
  const [periodId, setPeriodId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setPeriodId('')
    setSaving(false)
    setError('')
  }, [open])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!periodId || saving) return
    setSaving(true)
    setError('')
    const problem = await onConfirm(periodId)
    setSaving(false)
    if (problem) setError(problem)
  }

  return (
    <Modal open={open} onClose={onClose} label="로드맵에 추가">
      <form className="rm-form" onSubmit={handleSubmit}>
        <header className="rm-modal__head">
          <div>
            <p className="rm-eyebrow">내 로드맵에 추가</p>
            <h2 className="rm-modal__title">{title}</h2>
          </div>
          <button type="button" className="rm-icon-btn" aria-label="닫기" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <hr className="rm-divider" />

        {loading ? (
          <p className="rm-muted" role="status">학기 목록을 불러오는 중…</p>
        ) : loadError ? (
          <p className="rm-field-note is-error" role="alert">{loadError}</p>
        ) : periods.length === 0 ? (
          <p className="rm-muted">로드맵에 학기가 아직 없어요. 로드맵에서 학기를 먼저 추가해 주세요.</p>
        ) : (
          <label className="rm-field">
            <span className="rm-eyebrow">놓을 학기</span>
            <select className="rm-input" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
              <option value="" disabled>학기를 골라 주세요</option>
              {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}

        {error && <p className="rm-field-note is-error" role="alert">{error}</p>}
        <button type="submit" className="rm-primary-btn" disabled={!periodId || saving || loading}>
          {saving ? '추가하는 중…' : '이 학기에 추가'}
        </button>
      </form>
    </Modal>
  )
}

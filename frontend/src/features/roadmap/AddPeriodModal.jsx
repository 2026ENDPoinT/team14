import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { CloseIcon } from './icons.jsx'
import { periodLabel } from './layout.js'
import { CUSTOM_NAME_MAX, PERIOD_TYPES } from '../../services/periods.js'

const END = 'end'

// 학기 추가 창 (+ 메뉴의 '학기 추가')
// - 종류: 휴학 · 군휴학 · 교환학생 · 기타(이름 직접 입력, 1~10자) / 위치: 어떤 학기 바로 뒤, 또는 맨 끝
// - 저장 요청마다 요청 id를 함께 보낸다. 같은 선택으로 다시 누르면(재시도) 같은 id라 서버에서 중복으로 만들지 않는다.
// props: open, periods(순서대로), onClose, onSubmit({ type, afterPeriodId, requestId }) → 성공 null / 실패 오류 문구
export default function AddPeriodModal({ open, periods, onClose, onSubmit }) {
  const [type, setType] = useState('leave')
  const [after, setAfter] = useState(END)
  const [name, setName] = useState('') // 기타일 때 이름
  const [requestId, setRequestId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const sorted = [...periods].sort((a, b) => a.order - b.order)

  // 열 때마다 초기화 (기본: 휴학, 맨 끝)
  useEffect(() => {
    if (!open) return
    setType('leave')
    setAfter(END)
    setName('')
    setRequestId(crypto.randomUUID())
    setSaving(false)
    setSaveError('')
  }, [open])

  // 선택을 바꾸면 새 요청으로 본다
  const choose = (setter) => (value) => {
    setter(value)
    setRequestId(crypto.randomUUID())
    setSaveError('')
  }

  // 미리보기: 앞 학기 → 새 칸 → 뒤 학기
  const isCustom = type === 'custom'
  const trimmed = name.trim()
  const nameError = isCustom && !trimmed ? '이름을 입력해 주세요.' : ''
  const label = isCustom ? trimmed || '이름' : PERIOD_TYPES.find((t) => t.type === type)?.label
  const index = after === END ? sorted.length - 1 : sorted.findIndex((p) => p.id === after)
  const prev = sorted[index]
  const next = sorted[index + 1]
  const preview = [prev && periodLabel(prev), `[${label}]`, next && periodLabel(next)].filter(Boolean).join(' → ')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving || nameError) return
    setSaving(true)
    setSaveError('')
    const error = await onSubmit({ type, afterPeriodId: after === END ? null : after, requestId, name: isCustom ? trimmed : null })
    setSaving(false)
    if (error) setSaveError(error) // 선택은 그대로, 같은 요청 id로 다시 시도
  }

  return (
    <Modal open={open} onClose={onClose} label="학기 추가">
      <form className="rm-form" onSubmit={handleSubmit}>
        <header className="rm-modal__head">
          <div>
            <p className="rm-eyebrow">타임라인</p>
            <h2 className="rm-modal__title">학기 추가</h2>
          </div>
          <button type="button" className="rm-icon-btn" aria-label="닫기" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <hr className="rm-divider" />

        <div className="rm-field">
          <span className="rm-eyebrow" id="add-period-type">종류</span>
          <div className="rm-chips" role="radiogroup" aria-labelledby="add-period-type">
            {PERIOD_TYPES.map((t) => (
              <button
                key={t.type}
                type="button"
                role="radio"
                aria-checked={t.type === type}
                className={`rm-chip ${t.type === type ? 'is-selected' : ''}`}
                onClick={() => choose(setType)(t.type)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {isCustom && (
          <label className="rm-field">
            <span className="rm-eyebrow">이름</span>
            <input
              className="rm-input"
              value={name}
              maxLength={CUSTOM_NAME_MAX}
              placeholder="예: 계절학기, 인턴십, 어학연수"
              aria-label="기타 이름"
              onChange={(e) => choose(setName)(e.target.value)}
            />
            <p className={`rm-field-note ${nameError ? 'is-error' : ''}`}>
              {nameError || `${[...trimmed].length}/${CUSTOM_NAME_MAX}자`}
            </p>
          </label>
        )}

        <label className="rm-field">
          <span className="rm-eyebrow">위치</span>
          <select className="rm-input rm-select" value={after} onChange={(e) => choose(setAfter)(e.target.value)}>
            {sorted.map((p) => (
              <option key={p.id} value={p.id}>{p.name} 뒤</option>
            ))}
            <option value={END}>맨 끝</option>
          </select>
          <p className="rm-field-note" data-testid="period-preview">{preview}</p>
          <p className="rm-field-note">기존 학기 이름과 그 안의 활동·연결선은 그대로이고, 뒤 학기들만 한 칸씩 밀려요.</p>
        </label>

        {saveError && <p className="rm-field-note is-error" role="alert">{saveError}</p>}
        <button type="submit" className="rm-primary-btn" disabled={saving || !requestId || Boolean(nameError)}>
          {saving ? '저장 중…' : saveError ? '다시 시도' : '추가하기'}
        </button>
      </form>
    </Modal>
  )
}

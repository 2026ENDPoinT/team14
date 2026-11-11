// 온보딩 화면에서 함께 쓰는 작은 UI 조각 (Figma 온보딩 프레임 기준)

// 위쪽 진행률 바 + 이전 버튼
export function ProgressHeader({ percent, onBack }) {
  return (
    <header className="ob-progress">
      {onBack ? (
        <button type="button" className="ob-back" aria-label="이전 단계" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      ) : (
        <span className="ob-back is-empty" aria-hidden="true" />
      )}
      <div className="ob-progress__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className="ob-progress__fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="ob-progress__label">{percent}%</span>
    </header>
  )
}

// 단계 제목 (가운데 정렬)
export function StepTitle({ children }) {
  return <h1 className="ob-title">{children}</h1>
}

// 대화 말풍선: from 'bot'(왼쪽 질문) | 'me'(오른쪽 내 답)
// onClick이 있으면 눌러서 답을 고칠 수 있다.
export function Bubble({ from = 'bot', muted = false, onClick, label, children }) {
  const className = `ob-bubble ob-bubble--${from} ${muted ? 'is-muted' : ''}`
  if (onClick) {
    return (
      <button type="button" className={`${className} is-editable`} onClick={onClick} aria-label={label}>
        {children}
      </button>
    )
  }
  return <p className={className}>{children}</p>
}

// 선택 칩 (다시 누르면 해제)
export function Chip({ selected = false, onClick, size, children, count }) {
  return (
    <button
      type="button"
      className={`ob-chip ${size ? `ob-chip--${size}` : ''} ${selected ? 'is-selected' : ''}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
      {count > 0 && <span className="ob-chip__count">{count}</span>}
    </button>
  )
}

// 작은 회색 안내 문구 (info 아이콘)
export function Hint({ children, tone }) {
  return (
    <p className={`ob-hint ${tone ? `ob-hint--${tone}` : ''}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </svg>
      <span>{children}</span>
    </p>
  )
}

// 아래쪽 확인 버튼 + 건너뛰기
export function ActionBar({ onConfirm, confirmLabel = '확인', disabled = false, onSkip }) {
  return (
    <div className="ob-actions">
      <button type="button" className="ob-primary" onClick={onConfirm} disabled={disabled}>
        {confirmLabel}
      </button>
      {onSkip && (
        <button type="button" className="ob-skip" onClick={onSkip}>
          건너뛰기
        </button>
      )}
    </div>
  )
}

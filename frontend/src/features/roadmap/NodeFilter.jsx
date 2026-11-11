import { useEffect, useRef } from 'react'

// 노드 종류 필터 (상단 왼쪽 작은 버튼 + 팝오버)
// - categories: ADD NODE·NODE DETAILS와 같은 카테고리 목록 (기본 10개 + 직접 추가한 종류)
// - selected: 보이게 할 카테고리 id 목록. 비어 있으면 전체 보기
// - 화면 표시만 바꾼다 (노드 데이터·위치·학기는 그대로)
export default function NodeFilter({ open, onToggle, onClose, categories, selected, onChange }) {
  const ref = useRef(null)

  // 팝오버 밖을 누르면 닫기
  useEffect(() => {
    if (!open) return undefined
    const handle = (e) => {
      if (!ref.current?.contains(e.target)) onClose()
    }
    document.addEventListener('pointerdown', handle)
    return () => document.removeEventListener('pointerdown', handle)
  }, [open, onClose])

  const toggle = (id) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  const active = selected.length > 0

  return (
    <div className={`rm-filter ${open ? 'is-open' : ''}`} ref={ref}>
      <button
        type="button"
        className={`rm-filter__btn ${active ? 'is-active' : ''}`}
        aria-expanded={open}
        aria-label="노드 종류 필터"
        onClick={onToggle}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        FILTER
        {active && <span className="rm-filter__count">{selected.length}</span>}
      </button>

      {open && (
        <div className="rm-filter__panel" role="dialog" aria-label="노드 종류 필터">
          <div className="rm-filter__head">
            <span className="rm-eyebrow">NODE TYPE</span>
            <button type="button" className="rm-filter__all" onClick={() => onChange([])} disabled={!active}>
              전체 보기
            </button>
          </div>
          <div className="rm-chips" role="group" aria-label="보일 종류">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={selected.includes(c.id)}
                className={`rm-chip ${selected.includes(c.id) ? 'is-selected' : ''}`}
                onClick={() => toggle(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="rm-field-note">
            {active ? '고른 종류의 노드만 보여요. ' : '여러 종류를 함께 고를 수 있어요. '}
            화면 표시만 바뀌고 노드 위치와 데이터는 그대로예요.
          </p>
        </div>
      )}
    </div>
  )
}

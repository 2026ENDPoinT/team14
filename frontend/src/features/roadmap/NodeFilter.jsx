import { useEffect, useRef } from 'react'

// 활동 종류 필터 (상단 왼쪽 작은 버튼 + 팝오버). 걸러 보는 중이면 옆에 [전체 보기]
// - categories: 학기에 배치된 활동이 실제로 쓰는 종류만 (기본·직접 추가 종류 모두. 계산은 RoadmapPage)
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
        aria-label={active ? `종류 필터: ${selected.length}개 종류만 보는 중` : '종류 필터'}
        onClick={onToggle}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        종류 필터
        {active && <span className="rm-filter__count">{selected.length}</span>}
      </button>
      {/* 걸러 보는 중일 때: 상태와 [전체 보기]를 버튼 옆에 바로 보여 준다 */}
      {active && !open && (
        <span className="rm-filter__status">
          {selected.length}개 종류만 보는 중
          <button type="button" className="rm-filter__reset" onClick={() => onChange([])}>전체 보기</button>
        </span>
      )}

      {open && (
        <div className="rm-filter__panel" role="dialog" aria-label="종류 필터">
          <div className="rm-filter__head">
            <span className="rm-eyebrow">보일 종류 고르기</span>
            <button type="button" className="rm-filter__all" onClick={() => onChange([])} disabled={!active}>
              전체 보기
            </button>
          </div>
          {categories.length === 0 && <p className="rm-field-note rm-filter__empty">아직 로드맵에 배치된 활동이 없어요</p>}
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
            {active ? '고른 종류의 활동만 보여요. ' : '여러 종류를 함께 고를 수 있어요. '}
            화면 표시만 바뀌고 활동의 위치와 기록은 그대로예요.
          </p>
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef } from 'react'

const ITEM_HEIGHT = 40 // 휠 한 칸 높이 (Memories.css의 .mm-wheel__item과 같아야 함)

// 휠 한 줄 (연도 또는 월). 위아래로 스크롤하다 멈추면 가운데 칸이 선택된다.
// items: [{ value, label, disabled }]
function WheelColumn({ items, value, onChange, label }) {
  const ref = useRef(null)
  const timer = useRef(null)
  const index = items.findIndex((item) => item.value === value)

  // 선택값이 바뀌면 그 칸이 가운데 오도록 스크롤 (처음 열 때는 애니메이션 없이)
  const first = useRef(true)
  useEffect(() => {
    const el = ref.current
    if (!el || index < 0) return
    const top = index * ITEM_HEIGHT
    if (Math.abs(el.scrollTop - top) > 1) {
      el.scrollTo({ top, behavior: first.current ? 'auto' : 'smooth' })
    }
    first.current = false
  }, [index])

  useEffect(() => () => clearTimeout(timer.current), [])

  // 스크롤이 멈추면(120ms) 가운데 칸을 선택. 고를 수 없는 칸이면 가장 가까운 선택 가능 칸으로
  function handleScroll() {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      let i = Math.round(ref.current.scrollTop / ITEM_HEIGHT)
      i = Math.max(0, Math.min(items.length - 1, i))
      while (i > 0 && items[i].disabled) i -= 1
      if (items[i].value !== value) onChange(items[i].value)
      else ref.current.scrollTo({ top: i * ITEM_HEIGHT, behavior: 'smooth' })
    }, 120)
  }

  // 키보드 ↑↓로도 이동
  function handleKeyDown(e) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const next = items[index + (e.key === 'ArrowDown' ? 1 : -1)]
    if (next && !next.disabled) onChange(next.value)
  }

  return (
    <div
      ref={ref}
      className="mm-wheel__col"
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
    >
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="option"
          aria-selected={item.value === value}
          tabIndex={-1}
          className={`mm-wheel__item ${item.value === value ? 'is-active' : ''}`}
          disabled={item.disabled}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

// 연·월 빠른 선택 (휠 방식). 미래 달은 고를 수 없다.
// 고르면 바로 onChange로 알려 주어 뒤의 달력이 함께 바뀐다.
export default function MonthPicker({ year, month, minYear, maxYear, maxMonth, onChange, onClose }) {
  const boxRef = useRef(null)

  // 바깥 클릭 · ESC로 닫기
  useEffect(() => {
    function handleDown(e) {
      // ▾ 버튼은 제외 (버튼이 직접 열고 닫는다)
      if (e.target.closest('.mm-month__toggle')) return
      if (boxRef.current && !boxRef.current.contains(e.target)) onClose()
    }
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const years = []
  for (let y = minYear; y <= maxYear; y += 1) years.push({ value: y, label: `${y}년` })

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}월`,
    disabled: year === maxYear && i + 1 > maxMonth, // 올해의 미래 달
  }))

  // 연도를 바꿨는데 그 해에는 아직 없는 달이면 이번 달로 맞춘다
  function changeYear(nextYear) {
    const nextMonth = nextYear === maxYear ? Math.min(month, maxMonth) : month
    onChange({ year: nextYear, month: nextMonth })
  }

  return (
    <div ref={boxRef} className="mm-picker" role="dialog" aria-label="연도와 월 선택">
      <div className="mm-wheel">
        <WheelColumn items={years} value={year} onChange={changeYear} label="연도" />
        <WheelColumn items={months} value={month} onChange={(m) => onChange({ year, month: m })} label="월" />
      </div>
      <button type="button" className="mm-picker__done" onClick={onClose}>완료</button>
    </div>
  )
}

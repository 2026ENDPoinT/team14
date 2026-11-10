import { toDateString } from './dateUtils.js'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 월간 캘린더 (추억 보관소 2-10)
// - diaryDates: 일기가 있는 날짜 목록 → 노란 점 표시
// - 미래 날짜는 누를 수 없다 (일기 작성 규칙과 같음)
// - onHover(date, x, y): 마우스를 올린 날짜와 커서 위치 (벗어나면 date = null) → 미리보기 표시용
export default function MemoryCalendar({ year, month, today, diaryDates, onSelect, onHover }) {
  const firstWeekday = new Date(year, month - 1, 1).getDay() // 1일의 요일 (0 = 일요일)
  const daysInMonth = new Date(year, month, 0).getDate() // 이번 달 마지막 날

  // 1일 앞의 빈칸 + 1일~말일
  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="mm-calendar" onMouseLeave={() => onHover(null)}>
      {WEEKDAYS.map((w, i) => (
        <span key={w} className={`mm-weekday ${i === 0 ? 'is-sun' : ''}`}>{w}</span>
      ))}

      {cells.map((day, i) => {
        if (day === null) return <span key={`blank-${i}`} />

        const date = toDateString(year, month, day)
        const isFuture = date > today
        const hasDiary = diaryDates.includes(date)
        const classes = ['mm-day', date === today && 'is-today', hasDiary && 'has-diary']
          .filter(Boolean).join(' ')

        return (
          <button
            key={date}
            type="button"
            className={classes}
            disabled={isFuture}
            aria-label={`${month}월 ${day}일${hasDiary ? ', 일기 있음' : ''}`}
            onClick={() => onSelect(date)}
            onMouseMove={(e) => !isFuture && onHover(date, e.clientX, e.clientY)}
            onMouseLeave={() => onHover(null)}
          >
            <span className="mm-day__num">{day}</span>
            <span className="mm-day__dot" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

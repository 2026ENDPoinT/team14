import { toDateString } from './dateUtils.js'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 일기 화면 달력: 동그란 날짜 버튼 (일기 쓴 날 = 노란 점, 오늘 = 진한 테두리)
// 미래 날짜는 누를 수 없다 (일기 작성 규칙과 같음)
export default function DiaryCalendar({ year, month, today, diaryDates, onSelect }) {
  const firstWeekday = new Date(year, month - 1, 1).getDay() // 1일의 요일 (0 = 일요일)
  const daysInMonth = new Date(year, month, 0).getDate()

  // 1일 앞의 빈칸 + 1일~말일
  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="dp-calendar">
      {WEEKDAYS.map((w) => (
        <span key={w} className="dp-weekday">{w}</span>
      ))}

      {cells.map((day, i) => {
        if (day === null) return <span key={`blank-${i}`} />

        const date = toDateString(year, month, day)
        const hasDiary = diaryDates.includes(date)
        const classes = ['dp-day', date === today && 'is-today', hasDiary && 'has-diary']
          .filter(Boolean).join(' ')

        return (
          <button
            key={date}
            type="button"
            className={classes}
            disabled={date > today}
            aria-label={`${month}월 ${day}일${hasDiary ? ', 일기 있음' : ''}`}
            onClick={() => onSelect(date)}
          >
            {day}
          </button>
        )
      })}
    </div>
  )
}

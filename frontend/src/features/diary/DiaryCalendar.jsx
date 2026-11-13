import { toDateString } from './dateUtils.js'
import { getWeekStart } from '../mypage/settingsStore.js'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

// 일기 화면 달력: 동그란 날짜 버튼 (일기 쓴 날 = 노란 점, 오늘 = 진한 테두리)
// 미래 날짜는 누를 수 없다 (일기 작성 규칙과 같음)
// activitiesByDate: { 'YYYY-MM-DD': [노드] } 그날 마감·목표일인 주요 활동 (있으면 날짜 위에 작은 깃발)
export default function DiaryCalendar({ year, month, today, diaryDates, activitiesByDate = {}, onSelect }) {
  // 시작 요일: 마이페이지 '화면 설정'의 달력 시작 요일 (일요일 / 월요일)
  const startIndex = getWeekStart() === 'mon' ? 1 : 0
  const weekdays = [...WEEKDAYS.slice(startIndex), ...WEEKDAYS.slice(0, startIndex)]
  const firstWeekday = (new Date(year, month - 1, 1).getDay() - startIndex + 7) % 7 // 1일 앞 빈칸 수
  const daysInMonth = new Date(year, month, 0).getDate()

  // 1일 앞의 빈칸 + 1일~말일
  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="dp-calendar">
      {weekdays.map((w) => (
        <span key={w} className="dp-weekday">{w}</span>
      ))}

      {cells.map((day, i) => {
        if (day === null) return <span key={`blank-${i}`} />

        const date = toDateString(year, month, day)
        const hasDiary = diaryDates.includes(date)
        const acts = activitiesByDate[date] ?? []
        const classes = ['dp-day', date === today && 'is-today', hasDiary && 'has-diary']
          .filter(Boolean).join(' ')

        return (
          <button
            key={date}
            type="button"
            className={classes}
            disabled={date > today}
            aria-label={`${month}월 ${day}일${hasDiary ? ', 일기 있음' : ''}${acts.length ? `, 활동: ${acts.map((a) => a.title).join(', ')}` : ''}`}
            title={acts.length ? acts.map((a) => a.title).join(', ') : undefined}
            onClick={() => onSelect(date)}
          >
            {day}
            {acts.length > 0 && (
              <span className="dp-day__act" aria-hidden="true">
                <FlagIcon />
                {acts.length > 1 && <span className="dp-day__act-count">{acts.length}</span>}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// 활동 표시용 작은 깃발
function FlagIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
    </svg>
  )
}

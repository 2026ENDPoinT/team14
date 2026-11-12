import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import MemoryCalendar from '../features/diary/MemoryCalendar.jsx'
import MonthPicker from '../features/diary/MonthPicker.jsx'
import { listDiaries, useDiaries } from '../features/diary/diaryStore.js'
import { getTodayKST, toDateString } from '../features/diary/dateUtils.js'
// 일기 화면과 같은 디자인 (로드맵 rm-* 스타일 + 일기 페이지 틀)
import '../features/roadmap/roadmap.css'
import '../features/diary/DiaryEditor.css'
import '../features/diary/Memories.css'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const PICKER_YEARS = 6 // 빠른 선택에서 올해부터 몇 년 전까지 보여 줄지 (대학 4년 + 휴학·군 복무 여유)
const HOVER_CARD_WIDTH = 240 // 미리보기 카드 폭 (Memories.css의 .mm-hover와 같아야 함)
const CURSOR_GAP = 16 // 커서와 미리보기 카드 사이 간격

// '2026-11-08' → '11월 8일 (일)'
function formatDateShort(date) {
  const [y, m, d] = date.split('-').map(Number)
  return `${m}월 ${d}일 (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`
}

// 추억 보관소 페이지 (/memories): 캘린더 (TASKS 2-10)
// - 날짜에 마우스를 올리면 커서 옆에 그날 일기 미리보기
// - 날짜를 누르면 그 날짜의 일기 화면(작성·수정)으로 이동
// 데이터는 아직 Mock (2-9 데이터 연동 때 services 함수로 교체)
export default function MemoriesPage() {
  const navigate = useNavigate()
  const today = getTodayKST()
  const [todayYear, todayMonth] = today.split('-').map(Number)

  // 처음 볼 달: 일기 화면에서 돌아온 경우 ?month=YYYY-MM 의 달, 아니면 이번 달
  const [searchParams] = useSearchParams()
  const [view, setView] = useState(() => {
    const match = /^(\d{4})-(\d{2})$/.exec(searchParams.get('month') || '')
    if (match) {
      const year = Number(match[1])
      const month = Number(match[2])
      const inRange = year >= todayYear - PICKER_YEARS && month >= 1 && month <= 12
      const notFuture = year < todayYear || (year === todayYear && month <= todayMonth)
      if (inRange && notFuture) return { year, month }
    }
    return { year: todayYear, month: todayMonth }
  }) // 보고 있는 달
  const [pickerOpen, setPickerOpen] = useState(false) // 연·월 빠른 선택 휠
  const [hover, setHover] = useState(null) // { date, x, y } 마우스를 올린 날짜와 커서 위치
  const closePicker = useCallback(() => setPickerOpen(false), [])

  useDiaries() // 내 일기를 서버에서 불러온다 (불러오면 다시 그려진다)

  // 보고 있는 달의 일기 목록
  const lastDay = new Date(view.year, view.month, 0).getDate()
  const monthDiaries = listDiaries(
    toDateString(view.year, view.month, 1),
    toDateString(view.year, view.month, lastDay),
  )

  // 이번 달보다 뒤(미래 달)로는 넘어가지 않는다
  const isCurrentMonth = view.year === todayYear && view.month === todayMonth

  function moveMonth(step) {
    setView(({ year, month }) => {
      const next = new Date(year, month - 1 + step, 1)
      return { year: next.getFullYear(), month: next.getMonth() + 1 }
    })
  }

  function handleHover(date, x, y) {
    setHover(date ? { date, x, y } : null)
  }

  return (
    <div className="diary-page">
      <main className="dy-main">
        <section className="dy-card rm-form" aria-label="추억 보관소">
          <header className="rm-modal__head">
            <div>
              <p className="rm-eyebrow">지난 일기 모아 보기</p>
              <h1 className="rm-modal__title">추억 보관소</h1>
            </div>
          </header>
          <hr className="rm-divider" />

          {/* 달력 전체를 일기 입력칸과 같은 노드 카드 모양으로 감싼다 */}
          <div className="dy-node dy-node--top mm-box-wrap">
            <span className={`dy-node__dot ${monthDiaries.length > 0 ? 'is-done' : ''}`} aria-hidden="true" />
            <div className="dy-input mm-box">
              {/* 달 이동 */}
              <div className="mm-month">
                <button type="button" className="rm-icon-btn" aria-label="이전 달" onClick={() => moveMonth(-1)}>
                  <ChevronIcon dir="left" />
                </button>
                <div className="mm-month__label">
                  {/* ▾를 누르면 연·월을 스크롤로 빠르게 고르는 휠이 열린다 */}
                  <button
                    type="button"
                    className={`mm-month__toggle ${pickerOpen ? 'is-open' : ''}`}
                    aria-expanded={pickerOpen}
                    onClick={() => setPickerOpen((v) => !v)}
                  >
                    <strong>{view.year}년 {view.month}월</strong>
                    <span className="mm-month__caret" aria-hidden="true">▾</span>
                  </button>
                  <span className="rm-muted">일기 {monthDiaries.length}개</span>
                  {pickerOpen && (
                    <MonthPicker
                      year={view.year}
                      month={view.month}
                      minYear={todayYear - PICKER_YEARS}
                      maxYear={todayYear}
                      maxMonth={todayMonth}
                      onChange={setView}
                      onClose={closePicker}
                    />
                  )}
                </div>
                <button
                  type="button"
                  className="rm-icon-btn"
                  aria-label="다음 달"
                  onClick={() => moveMonth(1)}
                  disabled={isCurrentMonth}
                >
                  <ChevronIcon dir="right" />
                </button>
              </div>

              <MemoryCalendar
                year={view.year}
                month={view.month}
                today={today}
                diaryDates={monthDiaries.map((d) => d.date)}
                onSelect={(date) => navigate(`/diary?date=${date}&from=memories`)}
                onHover={handleHover}
              />
            </div>
          </div>
        </section>
      </main>

      {/* 휠 선택기가 열려 있을 때는 미리보기를 띄우지 않는다 */}
      {hover && !pickerOpen && (
        <HoverPreview hover={hover} diary={monthDiaries.find((d) => d.date === hover.date)} />
      )}
    </div>
  )
}

// 커서 바로 옆에 뜨는 작은 일기 미리보기
function HoverPreview({ hover, diary }) {
  // 화면 오른쪽·아래 끝에 가까우면 커서 반대쪽에 띄운다
  const flipX = hover.x + CURSOR_GAP + HOVER_CARD_WIDTH > window.innerWidth
  const flipY = hover.y + CURSOR_GAP + 140 > window.innerHeight
  const style = {
    left: flipX ? hover.x - CURSOR_GAP - HOVER_CARD_WIDTH : hover.x + CURSOR_GAP,
    top: flipY ? undefined : hover.y + CURSOR_GAP,
    bottom: flipY ? window.innerHeight - hover.y + CURSOR_GAP : undefined,
  }

  return (
    <div className="mm-hover" style={style} aria-hidden="true">
      <p className="mm-hover__date">
        <span className={`mm-hover__dot ${diary ? 'is-done' : ''}`} />
        {formatDateShort(hover.date)}
      </p>
      {diary ? (
        <p className="mm-hover__body">{diary.content || '(내용 없음)'}</p>
      ) : (
        <p className="mm-hover__empty">아직 일기가 없어요. 눌러서 써 보세요.</p>
      )}
    </div>
  )
}

// 달 이동 화살표 (로드맵 아이콘과 같은 선 굵기)
function ChevronIcon({ dir }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  )
}

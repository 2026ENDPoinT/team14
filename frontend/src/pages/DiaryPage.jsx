import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import RoadmapNav from '../features/roadmap/RoadmapNav.jsx'
import DiaryCalendar from '../features/diary/DiaryCalendar.jsx'
import DiaryModal from '../features/diary/DiaryModal.jsx'
import MonthPicker from '../features/diary/MonthPicker.jsx'
import { listDiaries } from '../features/diary/diaryMock.js'
import { getPet } from '../features/pet/petMock.js'
import { getStageByNumber, PET_STAGES } from '../features/pet/petStages.js'

const MAX_WARMTH = PET_STAGES[PET_STAGES.length - 1].minEnergy // 최종 단계 기준 (5,000)
import { getTodayKST, isValidDateString, toDateString } from '../features/diary/dateUtils.js'
// 로드맵과 같은 디자인 (rm-* 스타일은 수정하지 않고 사용만)
import '../features/roadmap/roadmap.css'
import '../features/diary/DiaryEditor.css'
import '../features/diary/Memories.css' // 연·월 휠 선택기 스타일 (추억 보관소와 같이 씀)
import '../features/diary/DiaryHome.css'

const PICKER_YEARS = 6 // 휠에서 올해부터 몇 년 전까지 고를 수 있는지 (추억 보관소와 같음)

// 왼쪽 카드에 무작위로 보여 줄 작성 유도 질문
const PROMPTS = [
  '오늘은 어떤 하루를 보냈나요?',
  '오늘 가장 기억에 남는 순간은 언제였나요?',
  '오늘 나를 웃게 한 일이 있었나요?',
  '오늘 새로 알게 된 것이 있나요?',
  '오늘 조금 아쉬웠던 일은 무엇인가요?',
  '오늘 고마웠던 사람이 있나요?',
  '내일의 나에게 하고 싶은 말이 있나요?',
  '오늘 수업이나 활동에서 무엇을 느꼈나요?',
]
// 지금과 다른 질문 하나를 고른다
function pickPrompt(current) {
  const others = PROMPTS.filter((p) => p !== current)
  return others[Math.floor(Math.random() * others.length)]
}

// 일기 페이지 (/diary)
// 왼쪽: 소개·이번 달 기록 수 / 오른쪽: 달력. 날짜를 누르면 그날 일기 팝업이 뜬다.
// /diary?date=2026-11-08 로 들어오면 그 날짜 팝업을 바로 연다. (추억 보관소에서 이동)
// &from=memories 가 붙어 있으면 팝업을 닫을 때 추억 보관소로 돌아간다.
export default function DiaryPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const today = getTodayKST()
  const [todayYear, todayMonth] = today.split('-').map(Number)

  const fromMemories = searchParams.get('from') === 'memories'
  const dateParam = searchParams.get('date')
  // 형식이 틀리거나 미래 날짜면 무시한다
  const initialDate = isValidDateString(dateParam) && dateParam <= today ? dateParam : null

  const [openDate, setOpenDate] = useState(initialDate) // 팝업으로 열린 날짜
  const [view, setView] = useState(() => {
    const base = initialDate || today
    const [year, month] = base.split('-').map(Number)
    return { year, month }
  }) // 보고 있는 달
  const [, setVersion] = useState(0) // 저장·삭제 후 달력을 다시 그리기 위한 값
  const [pickerOpen, setPickerOpen] = useState(false) // 연·월 빠른 선택 휠
  const [prompt, setPrompt] = useState(() => pickPrompt(null)) // 들어올 때마다 무작위 질문
  const closePicker = useCallback(() => setPickerOpen(false), [])

  // 보고 있는 달의 일기 목록
  const lastDay = new Date(view.year, view.month, 0).getDate()
  const monthDiaries = listDiaries(
    toDateString(view.year, view.month, 1),
    toDateString(view.year, view.month, lastDay),
  )
  const isCurrentMonth = view.year === todayYear && view.month === todayMonth
  const pet = getPet() // 일기를 저장해 온기를 받으면 다시 그릴 때 늘어난 값이 보인다
  const stage = getStageByNumber(pet.stage)

  function moveMonth(step) {
    setView(({ year, month }) => {
      const next = new Date(year, month - 1 + step, 1)
      return { year: next.getFullYear(), month: next.getMonth() + 1 }
    })
  }

  const closeModal = useCallback(() => {
    if (fromMemories && openDate) {
      navigate(`/memories?month=${openDate.slice(0, 7)}`)
      return
    }
    setOpenDate(null)
  }, [fromMemories, openDate, navigate])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  return (
    <div className="diary-page">
      <RoadmapNav />
      <main className="dp-main">
        {/* 왼쪽 소개 */}
        <aside className="dp-intro">
          <div>
            <h1 className="dp-title">MY DIARY</h1>
            <p className="dp-lead">날짜를 눌러 오늘의 마음을 남겨보세요.</p>
          </div>

          <ul className="dp-legend">
            <li><span className="dp-legend__dot is-done" aria-hidden="true" />일기 쓴 날</li>
            <li><span className="dp-legend__dot" aria-hidden="true" />아직 쓰지 않은 날</li>
          </ul>

          {/* 작성 유도 질문 (↻ 를 누르면 다른 질문) */}
          <div className="dp-stat">
            <div className="dp-stat__top">
              <p className="dp-stat__label">오늘의 질문</p>
              <button
                type="button"
                className="rm-icon-btn dp-stat__refresh"
                aria-label="다른 질문 보기"
                onClick={() => setPrompt((p) => pickPrompt(p))}
              >
                <RefreshIcon />
              </button>
            </div>
            <p className="dp-stat__prompt">{prompt}</p>
            <p className="dp-stat__hint">하루 한 줄도 충분해요.</p>
          </div>

          {/* 펫 온기: 전체(최종 단계 5,000)까지 얼마나 찼는지 + 단계 기준선 */}
          <div className="dp-warmth">
            <div className="dp-warmth__top">
              <span className="dp-warmth__label">지금의 나 : <strong>{stage.name}</strong></span>
              <span className="dp-warmth__num">
                {pet.energy.toLocaleString()} / {MAX_WARMTH.toLocaleString()}
              </span>
            </div>
            <div className="dp-warmth__bar" aria-hidden="true">
              <div
                className="dp-warmth__fill"
                style={{ width: `${Math.min(100, (pet.energy / MAX_WARMTH) * 100)}%` }}
              />
              {/* 단계 기준선 (1단계 0은 시작점이라 생략) */}
              {PET_STAGES.slice(1, -1).map((s) => (
                <span key={s.stage} className="dp-warmth__tick" style={{ left: `${(s.minEnergy / MAX_WARMTH) * 100}%` }} />
              ))}
            </div>
            <div className="dp-warmth__marks">
              {PET_STAGES.slice(1).map((s) => (
                <span
                  key={s.stage}
                  className={`dp-warmth__mark ${pet.energy >= s.minEnergy ? 'is-reached' : ''}`}
                  style={{ left: `${(s.minEnergy / MAX_WARMTH) * 100}%` }}
                >
                  {s.minEnergy.toLocaleString()}
                </span>
              ))}
            </div>
          </div>
        </aside>

        {/* 오른쪽 달력 카드 */}
        <section className="dp-cal-card" aria-label="일기 달력">
          <div className="dp-cal-head">
            {/* ▾를 누르면 연·월을 스크롤로 빠르게 고르는 휠이 열린다 */}
            <div className="dp-cal-head__label">
              <button
                type="button"
                className={`mm-month__toggle ${pickerOpen ? 'is-open' : ''}`}
                aria-expanded={pickerOpen}
                onClick={() => setPickerOpen((v) => !v)}
              >
                <strong className="dp-cal-head__title">{view.year}년 {view.month}월</strong>
                <span className="mm-month__caret" aria-hidden="true">▾</span>
              </button>
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
            <div className="dp-cal-head__nav">
              <button type="button" className="rm-icon-btn" aria-label="이전 달" onClick={() => moveMonth(-1)}>
                <ChevronIcon dir="left" />
              </button>
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
          </div>

          <DiaryCalendar
            year={view.year}
            month={view.month}
            today={today}
            diaryDates={monthDiaries.map((d) => d.date)}
            onSelect={setOpenDate}
          />
        </section>
      </main>

      {/* key: 다른 날짜를 열면 팝업을 새로 그린다 */}
      {openDate && <DiaryModal key={openDate} date={openDate} onClose={closeModal} onChanged={refresh} />}
    </div>
  )
}

function RefreshIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" />
    </svg>
  )
}

function ChevronIcon({ dir }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  )
}

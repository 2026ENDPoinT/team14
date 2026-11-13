import { useCallback, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import DiaryCalendar from '../features/diary/DiaryCalendar.jsx'
import DiaryModal from '../features/diary/DiaryModal.jsx'
import MonthPicker from '../features/diary/MonthPicker.jsx'
import HighlightTimeline from '../features/diary/HighlightTimeline.jsx'
import { groupByDate, useActivities } from '../features/diary/activities.js'
import { listDiaries, useDiaries } from '../features/diary/diaryStore.js'
import TimeCapsule from '../features/diary/TimeCapsule.jsx'
import { EMPTY_PET, usePet } from '../features/pet/petStore.js'
import { getStageByNumber, getStageInfo, PET_STAGES } from '../features/pet/petStages.js'

const MAX_WARMTH = PET_STAGES[PET_STAGES.length - 1].minEnergy // 최종 단계 기준 (5,000)
import { getTodayKST, isValidDateString, toDateString } from '../features/diary/dateUtils.js'
// 로드맵과 같은 디자인 (rm-* 스타일은 수정하지 않고 사용만)
import '../features/roadmap/roadmap.css'
import '../features/diary/DiaryEditor.css'
import '../features/diary/Memories.css' // 연·월 휠 선택기 스타일 (추억 보관소와 같이 씀)
import '../features/diary/DiaryHome.css'
import '../features/diary/Highlights.css'

const PICKER_YEARS = 6 // 휠에서 올해부터 몇 년 전까지 고를 수 있는지 (추억 보관소와 같음)


// 탭마다 주소가 따로 있다 (상단 메뉴의 하위 탭 '일기 쓰기 · 추억 보관소'와 같은 주소)
const TABS = [
  { key: 'diary', label: '일기', path: '/diary' },
  { key: 'highlights', label: '주요 활동', path: '/memories' },
]

// 추억 보관소 = 일기장 + 주요 활동 (/memories, /diary 모두 이 화면)
// - 일기 탭(처음 화면): 왼쪽 소개·AI 타임캡슐·온기 / 오른쪽 달력. 날짜를 누르면 그날 일기 팝업
//   주요 활동의 마감·목표일인 날짜에는 작은 깃발이 붙고, 팝업에 "이날의 활동"이 함께 보인다.
// - 주요 활동 탭: 로드맵의 주요 활동을 학기별로 (카드를 누르면 그날 일기로, 날짜가 없으면 로드맵으로)
// /diary = 일기 탭, /memories = 추억 보관소(주요 활동) 탭. ?date=2026-11-08 이 있으면 일기 탭에서 그 날짜 팝업을 연다
// [미확정] 일기·추억 보관소 통합은 SPEC 7장 수정·팀 확정 필요
export default function MemoriesPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const today = getTodayKST()
  const [todayYear, todayMonth] = today.split('-').map(Number)

  // 마이페이지(내 활동·기록 관리)에서 들어왔으면 왼쪽 위에 돌아가기 화살표
  const fromMyPage = searchParams.get('from') === 'mypage'
  const backTab = searchParams.get('tab') || 'activity'
  const dateParam = searchParams.get('date')
  // 형식이 틀리거나 미래 날짜면 무시한다
  const initialDate = isValidDateString(dateParam) && dateParam <= today ? dateParam : null

  const { pathname } = useLocation()
  const tab = pathname.startsWith('/memories') && !initialDate ? 'highlights' : 'diary' // 지금 주소로 탭을 정한다
  const changeTab = (key) => navigate(TABS.find((t) => t.key === key).path)
  const [openDate, setOpenDate] = useState(initialDate) // 팝업으로 열린 날짜
  const [view, setView] = useState(() => {
    const base = initialDate || today
    const [year, month] = base.split('-').map(Number)
    return { year, month }
  }) // 보고 있는 달
  const [, setVersion] = useState(0) // 저장·삭제 후 달력을 다시 그리기 위한 값
  const [pickerOpen, setPickerOpen] = useState(false) // 연·월 빠른 선택 휠
  const closePicker = useCallback(() => setPickerOpen(false), [])

  // 내 일기·펫 (서버). 불러오거나 저장하면 다시 그려진다
  const diaryData = useDiaries()
  const { pet: loadedPet } = usePet()
  // 주요 활동 (로드맵 노드, 읽기만)
  const activities = useActivities()
  const activitiesByDate = groupByDate(activities.nodes)

  // 보고 있는 달의 일기 목록
  const lastDay = new Date(view.year, view.month, 0).getDate()
  const monthDiaries = listDiaries(
    toDateString(view.year, view.month, 1),
    toDateString(view.year, view.month, lastDay),
  )
  const isCurrentMonth = view.year === todayYear && view.month === todayMonth
  const pet = loadedPet ?? EMPTY_PET // 일기로 온기를 받으면 서버가 돌려준 값으로 바로 바뀐다
  // 성장 단계: 누적 온기 기준 (서버 stage가 더 높으면 그 값 — 단계는 내려가지 않음, HOME과 같은 규칙)
  const stage = getStageByNumber(Math.max(pet.stage ?? 1, getStageInfo(pet.energy).stage))

  function moveMonth(step) {
    setView(({ year, month }) => {
      const next = new Date(year, month - 1 + step, 1)
      return { year: next.getFullYear(), month: next.getMonth() + 1 }
    })
  }

  const closeModal = useCallback(() => setOpenDate(null), [])

  // 주요 활동 카드: 로드맵으로 가서 그 노드가 있는 자리로 화면을 옮기고 잠깐 반짝여 보여 준다 (RoadmapPage ?focus=)
  function openActivity(node) {
    navigate(`/roadmap?focus=${encodeURIComponent(node.id)}`)
  }

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  return (
    <div className="diary-page">
      {/* 제목 + 탭 */}
      <header className="hl-head mm2-head">
        <div>
          {fromMyPage && (
            <button
              type="button"
              className="rm-icon-btn dy-back"
              aria-label="마이페이지로 돌아가기"
              onClick={() => navigate(`/mypage?tab=${backTab}`)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
            </button>
          )}
          <h1 className="dp-title">추억 보관소</h1>
          <p className="dp-lead">
            {tab === 'diary' ? '날짜를 눌러 오늘의 마음을 남겨보세요.' : '로드맵에 남긴 주요 활동을 학기별로 모아 봤어요. 카드를 누르면 그날의 일기로 가요.'}
          </p>
        </div>
        <div className="hl-tabs" role="tablist" aria-label="추억 보관소 보기">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={tab === t.key ? 'is-active' : ''}
              onClick={() => changeTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'highlights' ? (
        <main className="mm2-highlights">
          {activities.status === 'loading' && <p className="rm-muted">로드맵을 불러오는 중…</p>}
          {activities.status === 'error' && <p className="dp-save-error" role="alert">{activities.error.message}</p>}
          {activities.status === 'ready' && (
            <HighlightTimeline
              periods={activities.periods}
              nodes={activities.nodes}
              documents={activities.documents}
              onOpen={openActivity}
            />
          )}
        </main>
      ) : (
      <main className="dp-main mm2-main">
        {/* 왼쪽 소개 */}
        <aside className="dp-intro">
          <div>
            {diaryData.status === 'error' && (
              <p className="dp-save-error" role="alert">
                {diaryData.error.message}{' '}
                <button type="button" className="dp-text-btn" onClick={diaryData.reload}>다시 불러오기</button>
              </p>
            )}
          </div>

          <ul className="dp-legend">
            <li><span className="dp-legend__dot is-done" aria-hidden="true" />일기 쓴 날</li>
            <li><span className="dp-legend__dot" aria-hidden="true" />아직 쓰지 않은 날</li>
            <li><span className="dp-legend__flag" aria-hidden="true">⚑</span>활동 마감·목표일</li>
          </ul>

          {/* AI 타임캡슐: 과거의 나 돌아보기 (버튼을 눌렀을 때만 AI 호출) */}
          <TimeCapsule diaries={listDiaries('0000-01-01', '9999-12-31')} ready={diaryData.status === 'ready'} />

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
            activitiesByDate={activitiesByDate}
            onSelect={setOpenDate}
          />
        </section>
      </main>
      )}

      {/* key: 다른 날짜를 열면 팝업을 새로 그린다 */}
      {/* 일기 목록을 다 불러온 뒤에 연다 (먼저 열면 이미 쓴 일기가 빈 일기로 시작한다) */}
      {openDate && diaryData.status === 'ready' && (
        <DiaryModal
          key={openDate}
          date={openDate}
          activities={activitiesByDate[openDate] ?? []}
          onClose={closeModal}
          onChanged={refresh}
        />
      )}
    </div>
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

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getLastCareerRecommendation,
  getMyCompletedNodes,
  recommendCareer,
} from '../../services/careerRecommendation.js'
import { curriculum } from '../onboarding/courseRecommendationSlot.js'
import { rankKeywords } from '../onboarding/careerKeywords.js'
import { CAREERS } from '../onboarding/onboardingOptions.js'
import { CareerAiResult, CareerAiStep } from '../onboarding/OnboardingSteps.jsx'
import { completedCoursesOf } from './completedCourses.js'
import '../onboarding/onboarding.css'
import './career.css'

// 홈의 AI 진로 추천 (온보딩 이후). 온보딩의 추천 화면(CareerAiStep)과 recommend-career 함수를 그대로 쓴다.
// - 지난 추천이 있으면 결과·이유를 먼저 보여 주고 [다시 추천받기]
// - 성적은 이 화면 상태에만 두고 저장하지 않는다. 함수에는 역량 키워드만 간다.
// - 성공한 결과만 함수가 저장한다 → 실패해도 직전 결과가 남는다.
// - 희망 직무(profiles.interests)와 로드맵은 바꾸지 않는다.

const AI_IDLE = { status: 'idle', result: null, error: null }
const formatTime = (iso) =>
  iso ? new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }) : null

export default function CareerRecommendPanel({ onClose }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [last, setLast] = useState(null) // { job, reason, recommendedAt, basedOn? }
  const [courses, setCourses] = useState([])
  const [view, setView] = useState('input') // 'last' | 'input'
  const [pickedKeys, setPickedKeys] = useState([])
  const [grades, setGrades] = useState({})
  const [ai, setAi] = useState(AI_IDLE)

  useEffect(() => {
    let alive = true
    Promise.all([getLastCareerRecommendation(), getMyCompletedNodes()]).then(([lastRes, nodesRes]) => {
      if (!alive) return
      if (lastRes.error || nodesRes.error) setLoadError((lastRes.error ?? nodesRes.error).message)
      setLast(lastRes.data ?? null)
      setView(lastRes.data ? 'last' : 'input')
      setCourses(nodesRes.data ? completedCoursesOf(nodesRes.data, curriculum) : [])
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  // 과목·성적을 바꾸면 이전 오류는 지운다
  const change = (update) => {
    update()
    setAi(AI_IDLE)
  }

  async function request() {
    const graded = pickedKeys.filter((k) => grades[k]).map((k) => ({ courseKey: k, grade: grades[k] }))
    const keywords = rankKeywords(graded)
    if (keywords.length === 0) {
      setAi({ status: 'error', result: null, error: { message: '추천에 쓸 역량이 없어요. 다른 과목의 성적을 입력해 주세요.' } })
      return
    }
    setAi({ ...AI_IDLE, status: 'loading' })
    const response = await recommendCareer(keywords)
    if (response.error || !CAREERS.some((c) => c.id === response.data.job)) {
      // 실패: 직전 성공 결과(last)는 그대로 둔다
      setAi({ status: 'error', result: null, error: response.error ?? { message: '지금은 AI 추천을 받을 수 없어요.' } })
      return
    }
    setLast(response.data)
    setAi(AI_IDLE)
    setView('last')
  }

  return (
    <div className="onboarding career-panel" role="dialog" aria-modal="true" aria-label="AI 진로 추천">
      <div className="career-panel__top">
        <strong>AI 진로 추천</strong>
        <button type="button" className="career-panel__close" onClick={onClose} aria-label="닫기">✕</button>
      </div>
      <div className="ob-scroll">
        <div className="ob-screen">
          {loading ? (
            <p className="career-panel__status">불러오는 중…</p>
          ) : view === 'last' && last ? (
            <div key="last" className="ob-stage">
              <h1 className="ob-title">지난 AI 추천 결과예요.</h1>
              <div className="ob-body">
                <CareerAiResult result={last} label="마지막 추천" time={formatTime(last.recommendedAt)} />
                <p className="career-panel__note">
                  추천 결과는 참고용이에요. 희망 직무와 로드맵은 바뀌지 않아요.
                </p>
              </div>
              <div className="ob-actions">
                <button type="button" className="ob-primary" onClick={() => setView('input')}>다시 추천받기</button>
                <button type="button" className="ob-skip" onClick={onClose}>닫기</button>
              </div>
            </div>
          ) : (
            <div key="input" className="ob-stage">
              {loadError && <p className="career-panel__status" role="alert">{loadError}</p>}
              <CareerAiStep
                context="home"
                courses={courses}
                pickedKeys={pickedKeys.filter((k) => courses.some((c) => c.key === k))}
                grades={grades}
                ai={ai}
                onTogglePick={(key) => change(() => setPickedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key])))}
                onGrade={(key, grade) => change(() => setGrades((prev) => ({ ...prev, [key]: grade })))}
                onRequest={request}
                onSkip={onClose}
                onAddCourses={() => navigate('/roadmap')}
                onShowPrevious={last ? () => { setAi(AI_IDLE); setView('last') } : null}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

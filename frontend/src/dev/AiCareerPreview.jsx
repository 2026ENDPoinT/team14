import { useState } from 'react'
import { curriculum } from '../features/onboarding/courseRecommendationSlot.js'
import { rankKeywords } from '../features/onboarding/careerKeywords.js'
import { CAREERS } from '../features/onboarding/onboardingOptions.js'
import { ProgressHeader } from '../features/onboarding/OnboardingParts.jsx'
import { CareerAiStep, CareerStep } from '../features/onboarding/OnboardingSteps.jsx'
import '../features/onboarding/onboarding.css'

// 개발용 미리보기: 온보딩 'AI 진로 추천' 단계 (/dev/preview/ai-career, 로컬 개발 서버에서만 열린다)
// - 로그인 없이 기존 화면 컴포넌트를 그대로 띄운다. 가상 이수 과목 4개 중 3개에 성적을 미리 채워 둔다.
// - 추천 결과는 샘플이다. Edge Function·Gemini를 부르지 않고, DB에 아무것도 저장하지 않는다.
// - 주소에 ?fail=1을 붙이면 추천 실패(한도 초과) 화면을 볼 수 있다.

const SAMPLE_COURSE_TITLES = ['자료구조', '데이터베이스', '웹프로그래밍', '이산수학']
const SAMPLE_GRADES = { 웹프로그래밍: 'A+', 자료구조: 'A0', 데이터베이스: 'B+' } // 이산수학은 성적 없음
const SAMPLE_JOB = 'backend'

const sampleCourses = curriculum.courses.filter((c) => SAMPLE_COURSE_TITLES.includes(c.title))
const keyOf = (title) => sampleCourses.find((c) => c.title === title).key
const initialPicked = Object.keys(SAMPLE_GRADES).map(keyOf)
const initialGrades = Object.fromEntries(Object.entries(SAMPLE_GRADES).map(([title, grade]) => [keyOf(title), grade]))
const AI_IDLE = { status: 'idle', result: null, error: null }

export default function AiCareerPreview() {
  const fail = new URLSearchParams(window.location.search).has('fail')
  const [view, setView] = useState('ai') // 'ai' | 'career' | 'done'
  const [pickedKeys, setPickedKeys] = useState(initialPicked)
  const [grades, setGrades] = useState(initialGrades)
  const [ai, setAi] = useState(AI_IDLE)
  const [careerId, setCareerId] = useState(null)
  const [keywords, setKeywords] = useState([])

  const toggle = (key) => setPickedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  const change = (update) => {
    update()
    setAi(AI_IDLE)
  }

  // 실제 화면과 같은 방식으로 키워드를 만들되, 서버 대신 샘플 결과를 보여 준다
  function request() {
    const graded = pickedKeys.filter((k) => grades[k]).map((k) => ({ courseKey: k, grade: grades[k] }))
    const ranked = rankKeywords(graded)
    setKeywords(ranked)
    setAi({ ...AI_IDLE, status: 'loading' })
    setTimeout(() => {
      if (fail) {
        setAi({ status: 'error', result: null, error: { message: 'AI 추천 사용 한도를 넘었어요. 잠시 후 다시 시도하거나 직접 직무를 골라 주세요. (샘플)' } })
        return
      }
      const basedOn = ranked.slice(0, 3)
      setAi({
        status: 'result',
        error: null,
        result: { job: SAMPLE_JOB, basedOn, reason: `${basedOn.join(', ')} 역량을 바탕으로 서버와 데이터를 다루는 백엔드 개발자를 추천해요. (샘플 결과)` },
      })
    }, 600)
  }

  function restart() {
    setView('ai')
    setPickedKeys(initialPicked)
    setGrades(initialGrades)
    setAi(AI_IDLE)
    setCareerId(null)
    setKeywords([])
  }

  const career = CAREERS.find((c) => c.id === careerId)

  return (
    <main className="onboarding">
      <div className="ob-top">
        <ProgressHeader percent={67} onBack={view === 'career' ? () => setView('ai') : null} />
      </div>
      <div className="ob-scroll">
        <div className="ob-screen">
          <p className="ob-dev-note">
            개발용 미리보기 — 로그인 없이 보는 화면이에요. 추천 결과는 샘플이고 아무것도 저장하지 않아요.
            {keywords.length > 0 && ` (보낼 키워드: ${keywords.join(', ')})`}
          </p>
          <div key={view} className="ob-stage">
            {view === 'ai' && (
              <CareerAiStep
                courses={sampleCourses}
                pickedKeys={pickedKeys}
                grades={grades}
                ai={ai}
                onTogglePick={(key) => change(() => toggle(key))}
                onGrade={(key, grade) => change(() => setGrades((prev) => ({ ...prev, [key]: grade })))}
                onRequest={request}
                onAccept={() => {
                  setCareerId(ai.result.job)
                  setView('done')
                }}
                onChooseOther={() => setView('career')}
                onSkip={() => setView('career')}
              />
            )}
            {view === 'career' && (
              <CareerStep selectedId={careerId} onSelect={setCareerId} onNext={() => setView('done')} />
            )}
            {view === 'done' && (
              <div className="ob-welcome">
                <p className="ob-welcome__text">
                  미리보기 끝 — 선택한 직무: {career?.title ?? '없음'}
                  <br />
                  실제 온보딩에서는 이다음 ‘로드맵 구성’ 단계로 넘어가요. (저장하지 않음)
                </p>
                <button type="button" className="ob-primary" onClick={restart}>
                  처음부터 다시
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

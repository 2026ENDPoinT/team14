import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { completeOnboarding, moveNodes } from '../services/api.js'
import { recommendCareer } from '../services/careerRecommendation.js'
import { choosePet } from '../services/rewards.js'
import { setPetFromServer } from '../features/pet/petStore.js'
import { JOB_TO_PET, PET_CHARACTERS, petAssetUrl } from '../features/home/petCharacter.js'
import { useAuth } from '../features/auth/AuthProvider.jsx'
import { CAREERS, EXPERIENCE_GROUPS, TERMS, UNDECIDED_JOB } from '../features/onboarding/onboardingOptions.js'
import {
  curriculum,
  jobRelevance,
  selectCourses,
} from '../features/onboarding/courseRecommendationSlot.js'
import { placeCourseNodes } from '../features/onboarding/placeCourseNodes.js'
import { rankKeywords } from '../features/onboarding/careerKeywords.js'
import { ProgressHeader } from '../features/onboarding/OnboardingParts.jsx'
import {
  CareerAiStep,
  CareerStep,
  CourseStep,
  ExperienceStep,
  ProfileStep,
  PetStep,
  WelcomeStep,
} from '../features/onboarding/OnboardingSteps.jsx'
import '../features/onboarding/onboarding.css'

// 단계: 0 프로필 → 1 경험 → 2 수강 과목 → 3 AI 진로 추천(건너뛰기 가능) → 4 희망 직무 → 5 로드맵 구성
//       → 저장 성공 시 완료 화면
const STEP_COUNT = 6
const STEP = { profile: 0, experience: 1, course: 2, ai: 3, career: 4, pet: 5 }
// 마지막 단계에서 고를 수 있는 펫 5종 (기존 성장 2단계 그림)
const PET_OPTIONS = Object.entries(PET_CHARACTERS).map(([key, c]) => ({ key, label: c.label, image: petAssetUrl(key, 2) }))
const AI_IDLE = { status: 'idle', result: null, error: null }

// 개발용: 주소에 ?testCourse=1을 붙이면 저장 요청에만 테스트 과목 1개를 넣는다.
// (추천 목록·미리보기에는 표시하지 않음, 배포 빌드에서는 동작하지 않음)
const TEST_COURSE = {
  courseKey: 'test-course-01',
  title: '[테스트] 저장 확인용 과목',
  year: 1,
  semester: 1,
  completed: true,
}

const EXPERIENCE_ITEMS = EXPERIENCE_GROUPS.flatMap((group) => group.items)

// 배열에 값이 있으면 빼고, 없으면 넣는다.
function toggle(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { markOnboardingCompleted, finishOnboarding } = useAuth()
  const includeTestCourse =
    import.meta.env.DEV && new URLSearchParams(location.search).has('testCourse')

  // 모든 선택값은 이 페이지에 모아 두므로, 이전·다음으로 이동해도 유지된다.
  const [step, setStep] = useState(STEP.profile)
  const [done, setDone] = useState(false) // 저장 성공 → 완료 화면
  const [nickname, setNickname] = useState('')
  const [nicknameDone, setNicknameDone] = useState(false)
  const [termId, setTermId] = useState(null) // '2-1' 형식 (학년·학기)
  const [experienceIds, setExperienceIds] = useState([]) // 화면 항목 id
  const [completedCourseKeys, setCompletedCourseKeys] = useState([])
  const [careerId, setCareerId] = useState(null)
  // AI 진로 추천: 추천에 반영할 과목·성적은 화면 상태로만 둔다 (저장·전송하지 않음)
  const [aiPickedKeys, setAiPickedKeys] = useState([])
  const [grades, setGrades] = useState({}) // { 과목 키: 'A+' ... }
  const [ai, setAi] = useState(AI_IDLE)
  const setupMode = 'auto' // 로드맵 구성: 추천 과목을 권장 학기에 (구성 방식 고르는 화면은 없앰, 기존 기본값)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null) // { messages, fixes }
  // 과목 위치 저장 결과 (온보딩 저장 후 따로 실행): null | { moves, status: 'failed' | 'retrying' | 'saved' }
  const [placement, setPlacement] = useState(null)
  // 마지막 단계 펫: 직무를 고르면 기존 직무별 배정(JOB_TO_PET), 미정이면 직접 고른 펫(petChoice)
  const [petChoice, setPetChoice] = useState('')
  const completedRef = useRef(null) // 온보딩 저장(로드맵 생성) 성공 결과 → 펫 저장만 다시 시도할 때 중복 생성하지 않게

  const term = TERMS.find((t) => t.id === termId) ?? null
  const grade = term?.grade ?? null // 지금 DB에는 학년만 저장된다 (학기는 백엔드 변경 후)
  const career = CAREERS.find((c) => c.id === careerId) ?? null
  // 선정 함수에 넘길 직무 키 목록 (저장 가능한 키만, 대표 1개)
  // '아직 정하지 않음'은 관심 직무로 저장하지 않는다 (interests 빈 목록 → 전공필수 중심 기본 로드맵, 새싹 펫)
  const jobs = career?.dbKey && career.id !== UNDECIDED_JOB ? [career.dbKey] : []
  const autoPet = JOB_TO_PET[jobs[0]] ?? null // 직무별 펫 (없으면 마지막 단계에서 직접 고름)
  // 미래 학년 추천(직무 관련도)이 연결됐는지. 지금은 비어 있어 이수 과목만 저장된다.

  // AI 추천 단계에서 고를 수 있는 과목 = 이수했다고 고른 과목 (교과과정 순서)
  const completedCourses = curriculum.courses.filter((c) => completedCourseKeys.includes(c.key))
  const aiPicked = aiPickedKeys.filter((key) => completedCourseKeys.includes(key))

  const pickedExperiences = EXPERIENCE_ITEMS.filter((item) => experienceIds.includes(item.id))
  const unsupportedExperiences = pickedExperiences.filter((item) => !item.dbKey)

  // 과목 추천 초안: 학년·이수 과목·희망 직무만 사용 (경험은 사용하지 않음)
  const coursePreview = useMemo(() => {
    if (!grade) return { completed: [], recommended: [], missed: [] }
    // courseNodes: 이수 완료 + 남은 학년 추천 (저장 요청에 넣는다)
    // missedCourses: 현재 학년까지 아직 안 들은 필수·핵심 과목 (저장하지 않는다. 로드맵이 같은 함수로 다시 계산해 '수강 필요'로 안내)
    const { courseNodes, missedCourses } = selectCourses({
      grade,
      completedCourseKeys,
      jobs,
      curriculum,
      jobRelevance,
    })
    const completed = courseNodes.filter((node) => node.completed)
    const completedKeys = new Set(completed.map((node) => node.courseKey))
    // 이수 완료 과목은 추천에 중복으로 넣지 않는다.
    const recommended = courseNodes.filter(
      (node) => !node.completed && !completedKeys.has(node.courseKey),
    )
    return { completed, recommended, missed: missedCourses }
  }, [grade, completedCourseKeys, jobs.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  function goTo(nextStep) {
    setError(null)
    setStep(nextStep)
  }

  // 건너뛰기 (경험·수강 과목 단계만): 이 단계의 선택을 비우고 다음 단계로
  function skipStep() {
    if (step === STEP.experience) setExperienceIds([])
    if (step === STEP.course) setCompletedCourseKeys([])
    goTo(step + 1)
  }

  // 단계가 바뀌면 콘텐츠 영역을 맨 위로 (상단 바는 스크롤 영역 밖이라 움직이지 않는다)
  const scrollRef = useRef(null)
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [step])

  // 과목·성적을 바꾸면 이전 추천 결과·오류는 지운다
  function changeAiInput(update) {
    update()
    setAi(AI_IDLE)
  }

  // AI 진로 추천 요청: 성적은 여기서 키워드 순서로만 바꾸고, 키워드만 보낸다
  async function requestRecommendation() {
    const graded = aiPicked.filter((key) => grades[key]).map((key) => ({ courseKey: key, grade: grades[key] }))
    const keywords = rankKeywords(graded)
    if (keywords.length === 0) {
      setAi({ status: 'error', result: null, error: { message: '추천에 쓸 역량이 없어요. 다른 과목의 성적을 입력하거나 직접 직무를 골라 주세요.' } })
      return
    }
    setAi({ ...AI_IDLE, status: 'loading' })
    const response = await recommendCareer(keywords)
    const known = response.data && CAREERS.some((c) => c.id === response.data.job && c.dbKey)
    if (response.error || !known) {
      setAi({ status: 'error', result: null, error: response.error ?? { message: '지금은 AI 추천을 받을 수 없어요. 직접 직무를 골라 주세요.' } })
      return
    }
    setAi({ status: 'result', result: response.data, error: null })
  }

  // 저장 전에 지금 저장 계약으로 보낼 수 없는 선택이 있는지 확인한다.
  // (지원하지 않는 키를 보내거나, 조용히 빼고 저장하지 않는다)
  function findBlocked() {
    const messages = []
    const fixes = []
    if (unsupportedExperiences.length > 0) {
      const names = unsupportedExperiences.map((item) => `‘${item.title}’`).join(', ')
      messages.push(
        `선택한 경험 중 ${names}은(는) 아직 서버에 저장 항목이 없어 저장할 수 없어요. 지금 시작하려면 해당 경험의 선택을 해제해 주세요.`,
      )
      fixes.push({ step: STEP.experience, label: '경험 다시 선택하기' })
    }
    if (career && !career.dbKey) {
      messages.push(
        `‘${career.title}’ 직무는 추천 데이터가 아직 연결되지 않아 저장할 수 없어요. 다른 직무나 ‘아직 정하지 않음’을 선택해 주세요.`,
      )
      fixes.push({ step: STEP.career, label: '직무 다시 선택하기' })
    }
    return messages.length > 0 ? { messages, fixes } : null
  }

  // 완료: 펫을 먼저 저장(choose_pet)하고, 그다음 온보딩 저장(complete_onboarding)
  // - 펫 저장이 실패하면 온보딩은 아직 완료되지 않은 상태 → 새로고침·재로그인해도 온보딩에서 이어서 마칠 수 있다
  // - 직무 미정: 고른 펫을 pets.type에 저장 (직무와 따로). 실패하면 여기서 멈추고 다시 시도
  // - 직무를 고른 사용자: 펫 종류를 비운다(직무로 자동 결정, 앞서 미정으로 골라 둔 펫이 남지 않게). 실패해도 진행
  // - 온보딩 저장은 한 번만 (completedRef, 서버도 이미 완료면 CONFLICT) → 로드맵·과목 중복 생성 없음
  async function handleComplete() {
    if (completedRef.current) return finish(completedRef.current.placementFailed)
    const blocked = findBlocked()
    if (blocked) {
      setError(blocked)
      return
    }

    setSaving(true)
    setError(null)

    const picked = await choosePet(autoPet ? null : petChoice)
    if (picked.error && !autoPet) {
      setSaving(false)
      setError({ messages: [`고른 펫을 저장하지 못했어요. ${picked.error.message} 다시 눌러 주세요.`] })
      return
    }

    // 추천 과목: auto → 권장 학기 / inbox → 보관함 (위치는 RPC가 roadmap_mode로 정한다)
    const recommended = coursePreview.recommended
    const courseNodes = [...coursePreview.completed, ...recommended]
    const completedCourses = coursePreview.completed.map((node) => node.courseKey)
    if (includeTestCourse) {
      courseNodes.push(TEST_COURSE)
      completedCourses.push(TEST_COURSE.courseKey)
    }

    const result = await completeOnboarding({
      nickname: nickname.trim(),
      grade,
      experiences: [...new Set(pickedExperiences.map((item) => item.dbKey))], // 보관함 저장용 (같은 키는 1번만)
      completedCourses,
      interests: jobs,
      roadmapMode: setupMode, // 'auto' | 'inbox'
      courseNodes,
    })

    if (result.error) {
      setSaving(false)
      setError({ messages: [result.error.message] }) // 입력값은 그대로 둔다
      return
    }
    // 학기에 들어간 과목 노드를 타임라인 선 위에 겹치지 않게 놓는다 (RPC는 위치를 (0, 0)으로 저장)
    // 실패해도 온보딩·과목은 이미 저장됐으므로 완료로 진행하고, 완료 화면에서 위치 저장만 다시 시도하게 한다.
    const moves = placeCourseNodes(result.data)
    let placementFailed = false
    if (moves.length > 0) {
      const moved = await moveNodes(moves)
      placementFailed = Boolean(moved.error)
      setPlacement({ moves, status: moved.error ? 'failed' : 'saved' })
    }
    // 실제 저장에 성공했을 때만: 프로필의 완료 상태를 바로 반영 (이후 HOME 진입 허용)
    markOnboardingCompleted(result.data.user) // 최신 프로필(희망 직무 포함)을 바로 반영
    if (picked.data?.pet) setPetFromServer(picked.data.pet) // HOME 펫 종류를 서버 값으로 바로 맞춘다
    completedRef.current = { placementFailed }
    finish(placementFailed)
  }

  // HOME으로 (과목 위치 저장이 실패했으면 위치 저장만 다시 시도하는 완료 화면)
  function finish(placementFailed) {
    setSaving(false)
    if (placementFailed) return setDone(true)
    finishOnboarding() // 이제부터 /onboarding에 오면 HOME으로 보낸다
    navigate('/', { replace: true })
  }

  // 위치 저장만 다시 시도 (온보딩은 다시 제출하지 않는다. 같은 위치를 다시 보내므로 여러 번 눌러도 결과가 같다)
  async function retryPlacement() {
    setPlacement((prev) => ({ ...prev, status: 'retrying', retried: true }))
    const moved = await moveNodes(placement.moves)
    setPlacement((prev) => ({ ...prev, status: moved.error ? 'failed' : 'saved' }))
  }

  if (done) {
    return (
      <main className="onboarding">
        <WelcomeStep
          placement={placement}
          onRetryPlacement={retryPlacement}
          onStart={() => {
            finishOnboarding() // 이제부터 /onboarding에 오면 HOME으로 보낸다
            navigate('/', { replace: true })
          }}
        />
      </main>
    )
  }

  const percent = Math.round(((step + 1) / STEP_COUNT) * 100)

  return (
    <main className="onboarding">
      {/* 상단 바: 모든 단계에서 같은 자리. 스크롤 영역 밖에 두어 스크롤바·콘텐츠 양과 무관하게 고정 */}
      <div className="ob-top">
        <ProgressHeader percent={percent} onBack={step > 0 && !completedRef.current ? () => goTo(step - 1) : null} />
      </div>

      <div className="ob-scroll" ref={scrollRef}>
      <div className="ob-screen">
        {includeTestCourse && (
          <p className="ob-dev-note">
            개발용: 저장 요청에 테스트 과목 1개가 포함됩니다. (추천 목록에는 표시되지 않음)
          </p>
        )}

        {/* key={step}: 단계가 바뀔 때만 새로 그려서 등장 애니메이션 재생 (칩 선택·탭 전환 때는 재생 안 함) */}
        <div key={step} className="ob-stage">
        {step === STEP.profile && (
          <ProfileStep
            nickname={nickname}
            nicknameDone={nicknameDone}
            term={termId}
            onNicknameSubmit={(value) => {
              setNickname(value)
              setNicknameDone(true)
            }}
            onNicknameEdit={() => setNicknameDone(false)}
            onTermSelect={setTermId}
            onTermEdit={() => setTermId(null)}
            onNext={() => goTo(STEP.experience)}
          />
        )}

        {step === STEP.experience && (
          <ExperienceStep
            selectedIds={experienceIds}
            onToggle={(id) => setExperienceIds((prev) => toggle(prev, id))}
            hasUnsupported={unsupportedExperiences.length > 0}
            onNext={() => goTo(STEP.course)}
            onSkip={skipStep}
          />
        )}

        {step === STEP.course && (
          <CourseStep
            courses={curriculum.courses}
            selectedKeys={completedCourseKeys}
            onToggle={(key) => setCompletedCourseKeys((prev) => toggle(prev, key))}
            onNext={() => goTo(STEP.ai)}
            onSkip={skipStep}
          />
        )}

        {step === STEP.ai && (
          <CareerAiStep
            courses={completedCourses}
            pickedKeys={aiPicked}
            grades={grades}
            ai={ai}
            onTogglePick={(key) => changeAiInput(() => setAiPickedKeys((prev) => toggle(prev, key)))}
            onGrade={(key, grade) => changeAiInput(() => setGrades((prev) => ({ ...prev, [key]: grade })))}
            onRequest={requestRecommendation}
            onAccept={() => {
              setCareerId(ai.result.job) // 추천 직무를 최종 직무로 선택
              goTo(STEP.pet)
            }}
            onChooseOther={() => goTo(STEP.career)} // 기존 직무 선택 화면에서 직접 고른다
            onSkip={() => goTo(STEP.career)}
          />
        )}

        {step === STEP.career && (
          <CareerStep
            selectedId={careerId}
            onSelect={setCareerId}
            onNext={() => goTo(STEP.pet)}
            onStartBasic={() => {
              setCareerId(UNDECIDED_JOB) // 직무 없이 기본 로드맵 (관심 직무는 저장하지 않음)
              goTo(STEP.pet)
            }}
          />
        )}

        {step === STEP.pet && (
          <PetStep
            autoPet={autoPet}
            choice={petChoice}
            onChoose={setPetChoice}
            pets={PET_OPTIONS}
            saving={saving}
            error={error}
            onFix={goTo}
            onConfirm={handleComplete}
          />
        )}
        </div>
      </div>
      </div>
    </main>
  )
}

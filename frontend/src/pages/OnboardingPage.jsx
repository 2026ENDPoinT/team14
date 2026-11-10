import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { completeOnboarding } from '../services/api.js'
import {
  EXPERIENCES,
  GRADES,
  JOBS,
  ROADMAP_MODES,
  UNDECIDED_JOB,
} from '../features/onboarding/onboardingOptions.js'
import {
  curriculum,
  jobRelevance,
  selectCourses,
} from '../features/onboarding/courseRecommendationSlot.js'
import '../features/onboarding/onboarding.css'

const STEPS = ['프로필', '경험', '수강한 과목', '희망 직무', '확인']

// 개발용: 주소에 ?testCourse=1을 붙이면 저장 요청에만 테스트 과목 1개를 넣는다.
// (추천 목록·미리보기에는 표시하지 않음, 배포 빌드에서는 동작하지 않음)
const TEST_COURSE = {
  courseKey: 'test-course-01',
  title: '[테스트] 저장 확인용 과목',
  year: 1,
  semester: 1,
  completed: true,
}

// 배열에 값이 있으면 빼고, 없으면 넣는다.
function toggle(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const includeTestCourse =
    import.meta.env.DEV && new URLSearchParams(location.search).has('testCourse')

  const [step, setStep] = useState(0)
  const [nickname, setNickname] = useState('')
  const [grade, setGrade] = useState(null)
  const [experiences, setExperiences] = useState([])
  const [completedCourseKeys, setCompletedCourseKeys] = useState([])
  const [courseSearch, setCourseSearch] = useState('')
  const [jobs, setJobs] = useState([])
  const [roadmapMode, setRoadmapMode] = useState('auto')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const hasCurriculum = curriculum.courses.length > 0

  // 과목 추천 초안: 학년·이수 과목·희망 직무만 사용 (경험은 사용하지 않음)
  const coursePreview = useMemo(() => {
    if (!grade) return { completed: [], recommended: [] }
    const { courseNodes } = selectCourses({
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
    return { completed, recommended }
  }, [grade, completedCourseKeys, jobs])

  const filteredCourses = curriculum.courses.filter((course) =>
    course.title.includes(courseSearch.trim()),
  )

  function selectJob(key) {
    // "아직 정하지 않음"은 다른 직무와 함께 고를 수 없다.
    if (key === UNDECIDED_JOB) {
      setJobs(jobs.includes(key) ? [] : [key])
    } else {
      setJobs(toggle(jobs.filter((item) => item !== UNDECIDED_JOB), key))
    }
  }

  // 건너뛰기: 이 단계의 선택을 비우고 다음 단계로
  function skipStep() {
    if (step === 1) setExperiences([])
    if (step === 2) setCompletedCourseKeys([])
    if (step === 3) {
      setJobs([])
      setRoadmapMode('auto')
    }
    setStep(step + 1)
  }

  async function handleComplete() {
    setSaving(true)
    setError(null)

    const courseNodes = [...coursePreview.completed, ...coursePreview.recommended]
    const completedCourses = coursePreview.completed.map((node) => node.courseKey)
    if (includeTestCourse) {
      courseNodes.push(TEST_COURSE)
      completedCourses.push(TEST_COURSE.courseKey)
    }

    const result = await completeOnboarding({
      nickname: nickname.trim(),
      grade,
      experiences, // 보관함 저장용 (추천 계산에는 쓰지 않음)
      completedCourses,
      interests: jobs,
      roadmapMode,
      courseNodes,
    })

    setSaving(false)
    if (result.error) {
      setError(result.error) // 입력값은 그대로 둔다
      return
    }
    navigate('/roadmap')
  }

  const experienceTitles = EXPERIENCES.filter((item) => experiences.includes(item.key)).map(
    (item) => item.title,
  )
  const jobTitles = JOBS.filter((item) => jobs.includes(item.key)).map((item) => item.title)
  const modeTitle = ROADMAP_MODES.find((mode) => mode.key === roadmapMode).title

  return (
    <main className="onboarding">
      <h1>초기 설정</h1>
      <ol className="onboarding-steps">
        {STEPS.map((name, index) => (
          <li key={name} className={index === step ? 'is-current' : ''}>
            {index + 1}. {name}
          </li>
        ))}
      </ol>

      {includeTestCourse && (
        <p className="onboarding-dev-note">
          개발용: 저장 요청에 테스트 과목 1개가 포함됩니다. (추천 목록에는 표시되지 않음)
        </p>
      )}

      {/* STEP 1. 프로필 */}
      {step === 0 && (
        <section className="onboarding-card">
          <h2>프로필</h2>
          <label className="onboarding-field">
            닉네임 (선택)
            <input
              type="text"
              value={nickname}
              maxLength={20}
              onChange={(event) => setNickname(event.target.value)}
            />
          </label>

          <fieldset className="onboarding-field">
            <legend>현재 학년 (필수)</legend>
            <div className="onboarding-options">
              {GRADES.map((value) => (
                <label key={value} className="onboarding-option">
                  <input
                    type="radio"
                    name="grade"
                    checked={grade === value}
                    onChange={() => setGrade(value)}
                  />
                  {value}학년
                </label>
              ))}
            </div>
          </fieldset>
          <p className="onboarding-help">
            선택한 학년을 기준으로 교과과정 연계도에 따라 과목이 기본 배치되며, 학년과 과목
            배치는 나중에도 수정할 수 있습니다.
          </p>
          <p className="onboarding-help">
            휴학 중이라면 마지막으로 마친 학기의 학년을 선택해 주세요.
            <br />
            예: 2학년 1학기를 마치고 휴학했다면 → 2학년
          </p>
        </section>
      )}

      {/* STEP 2. 경험 (선택) */}
      {step === 1 && (
        <section className="onboarding-card">
          <h2>해 본 경험 (선택)</h2>
          <p className="onboarding-help">
            고른 경험은 로드맵의 보관함에 저장됩니다. 학기에 자동으로 배치되지 않아요.
          </p>
          <div className="onboarding-options">
            {EXPERIENCES.map((item) => (
              <label key={item.key} className="onboarding-option">
                <input
                  type="checkbox"
                  checked={experiences.includes(item.key)}
                  onChange={() => setExperiences(toggle(experiences, item.key))}
                />
                {item.title}
              </label>
            ))}
          </div>
        </section>
      )}

      {/* STEP 3. 수강한 과목 (선택) */}
      {step === 2 && (
        <section className="onboarding-card">
          <h2>수강한 전공과목 (선택)</h2>
          {!hasCurriculum ? (
            <p className="onboarding-empty">교과과정 데이터 준비 중</p>
          ) : (
            <>
              <p className="onboarding-help">
                학년과 관계없이 실제로 수강한 과목만 골라 주세요. 고른 과목은 이수 완료로 권장
                학기에 놓입니다. (실제 수강 학기가 아니에요)
              </p>
              <input
                type="search"
                placeholder="과목 이름 검색"
                value={courseSearch}
                onChange={(event) => setCourseSearch(event.target.value)}
              />
              <ul className="onboarding-course-list">
                {filteredCourses.map((course) => (
                  <li key={course.key}>
                    <label className="onboarding-option">
                      <input
                        type="checkbox"
                        checked={completedCourseKeys.includes(course.key)}
                        onChange={() =>
                          setCompletedCourseKeys(toggle(completedCourseKeys, course.key))
                        }
                      />
                      {course.year}학년 {course.semester}학기 · {course.title}
                      {course.category === '전공필수' && ' (전공필수)'}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* STEP 4. 희망 직무 (선택) */}
      {step === 3 && (
        <section className="onboarding-card">
          <h2>희망 직무 (선택)</h2>
          <div className="onboarding-options">
            {JOBS.map((item) => (
              <label key={item.key} className="onboarding-option">
                <input
                  type="checkbox"
                  checked={jobs.includes(item.key)}
                  onChange={() => selectJob(item.key)}
                />
                {item.title}
              </label>
            ))}
          </div>

          <fieldset className="onboarding-field">
            <legend>추천 과목을 어떻게 넣을까요?</legend>
            {ROADMAP_MODES.map((mode) => (
              <label key={mode.key} className="onboarding-option">
                <input
                  type="radio"
                  name="roadmapMode"
                  checked={roadmapMode === mode.key}
                  onChange={() => setRoadmapMode(mode.key)}
                />
                {mode.title} — {mode.description}
              </label>
            ))}
          </fieldset>
        </section>
      )}

      {/* 확인: 추천 미리보기 + 완료 */}
      {step === 4 && (
        <section className="onboarding-card">
          <h2>확인</h2>
          <dl className="onboarding-summary">
            <dt>닉네임</dt>
            <dd>{nickname.trim() || '나중에 설정'}</dd>
            <dt>학년</dt>
            <dd>{grade}학년</dd>
            <dt>희망 직무</dt>
            <dd>{jobTitles.length > 0 ? jobTitles.join(', ') : '선택 안 함'}</dd>
          </dl>

          <h3>이수 완료 과목</h3>
          {coursePreview.completed.length > 0 ? (
            <ul className="onboarding-preview-list">
              {coursePreview.completed.map((node) => (
                <li key={node.courseKey}>
                  <span className="onboarding-badge">완료</span>
                  {node.title} · 권장 {node.year}학년 {node.semester}학기
                </li>
              ))}
            </ul>
          ) : (
            <p className="onboarding-empty">고른 과목 없음</p>
          )}

          <h3>추천 과목 ({modeTitle})</h3>
          {!hasCurriculum ? (
            <p className="onboarding-empty">교과과정 데이터 준비 중</p>
          ) : coursePreview.recommended.length > 0 ? (
            <ul className="onboarding-preview-list">
              {coursePreview.recommended.map((node) => (
                <li key={node.courseKey}>
                  {node.title} ·{' '}
                  {roadmapMode === 'auto'
                    ? `${node.year}학년 ${node.semester}학기에 배치`
                    : '보관함에 추가'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="onboarding-empty">추천 과목 없음</p>
          )}

          <h3>공모전·대외활동 추천</h3>
          <p className="onboarding-empty">준비 중</p>

          <h3>보관함에 저장할 경험</h3>
          {experienceTitles.length > 0 ? (
            <p>{experienceTitles.join(', ')}</p>
          ) : (
            <p className="onboarding-empty">고른 경험 없음</p>
          )}

          {error && (
            <p className="onboarding-error" role="alert">
              저장하지 못했어요: {error.message}
            </p>
          )}
        </section>
      )}

      <div className="onboarding-actions">
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} disabled={saving}>
            이전
          </button>
        )}
        {step >= 1 && step <= 3 && (
          <button type="button" onClick={skipStep}>
            건너뛰기
          </button>
        )}
        {step < 4 && (
          <button
            type="button"
            className="is-primary"
            onClick={() => setStep(step + 1)}
            disabled={step === 0 && !grade}
          >
            다음
          </button>
        )}
        {step === 4 && (
          <button
            type="button"
            className="is-primary"
            onClick={handleComplete}
            disabled={saving}
          >
            {saving ? '저장 중…' : '완료'}
          </button>
        )}
      </div>
    </main>
  )
}

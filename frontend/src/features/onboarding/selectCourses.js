// 교과목 선정 함수 (docs/API.md 4.4, 작업표 4-14). 화면·DB에 접근하지 않는 순수 함수.
//
// 입력: { grade, completedCourseKeys, jobs, curriculum, jobRelevance }
//   grade: 현재 학년(1~4). 학기 정보는 없다 → 현재 학년 과목은 미래 추천(자동 배치)에 넣지 않고,
//          아직 안 들은 필수·핵심 과목이면 '수강 필요'로 안내한다.
//   jobs: 희망 직무 키 목록 (앱 직무 키: backend, frontend, mobile, ai, data, security, system_network,
//         embedded_iot, game, uiux). 'undecided'·'other'·관련도 표에 없는 키는 '직무 없음'으로 본다.
//
// 1. 이수 완료 (completed: true): 사용자가 고른 과목만. 학년과 무관하게 권장 학기에 둔다.
// 2. 미래 추천 (completed: false, year > grade, 미이수): 전공필수 또는 고른 직무 관련도(직무 여럿이면 최고 점수)가
//    minScore(2) 이상인 과목. 직무가 없으면 전공필수만.
// 3. 수강 필요 (missedCourses, year <= grade, 미이수): 전공필수, 고른 직무의 핵심 과목(관련도 3),
//    또는 미래 추천 과목의 '확인된' 선수과목. 직무가 없으면 전공필수만.
//    - 선수과목은 교과과정 데이터의 course.prerequisites(과목 키 목록)만 쓴다. 과목명·학기 순서로 추정하지 않는다.
//      (지금 데이터에는 공식 선수관계가 없다 — docs/API.md 4.4. 데이터가 생기면 이 규칙이 자동으로 적용된다)
//    - 로드맵에 자동 배치하지 않는다. 로드맵이 '수강 필요'로 안내하고, 사용자가 원하면 추가한다.
// 4. 과목 키로 중복을 없앤다: 이수 과목은 추천·수강 필요에서 빠지고, 여러 이유로 뽑힌 과목도 한 번만 나온다.
//
// 출력: { courseNodes: [{ courseKey, title, year, semester, completed, reasons }],
//         missedCourses: [{ courseKey, title, year, semester, reasons }] }
//   courseNodes는 complete_onboarding 요청에 그대로 넣는다. (reasons는 보내지 않아도 된다)
//   reasons: [{ type: 'required' | 'core' | 'related' | 'prerequisite', job?, label }]
//   결과 순서는 교과과정 데이터 순서(학기 → 연계도 위→아래)와 같다.

import { FIELD_LABELS } from '../explore/jobField.js'

const REQUIRED = '전공필수'
const CORE_SCORE = 3

// 고른 직무 중 관련도 표에 있는 것만 (중복 없이)
export function scoredJobsOf(jobs, jobRelevance) {
  return [...new Set((jobs ?? []).filter((job) => jobRelevance?.jobs?.[job]))]
}

const jobName = (job) => FIELD_LABELS[job] ?? job

// 과목 하나가 왜 뽑히는지 (직무별 점수·전공필수). minScore 이상인 직무만 이유로 남긴다.
export function courseReasons(course, scoredJobs, jobRelevance, minScore = jobRelevance?.minScore ?? 2) {
  const reasons = []
  if (course.category === REQUIRED) reasons.push({ type: 'required', label: '전공필수' })
  for (const job of scoredJobs) {
    const score = jobRelevance.jobs[job][course.key] ?? 0
    if (score >= CORE_SCORE) reasons.push({ type: 'core', job, label: `${jobName(job)} 핵심 과목` })
    else if (score >= minScore) reasons.push({ type: 'related', job, label: `${jobName(job)} 관련 과목` })
  }
  return reasons
}

export function selectCourses({ grade, completedCourseKeys = [], jobs = [], curriculum, jobRelevance }) {
  const courses = curriculum?.courses ?? []
  const completed = new Set(completedCourseKeys)
  const scoredJobs = scoredJobsOf(jobs, jobRelevance)
  const minScore = jobRelevance?.minScore ?? 2
  const byKey = new Map(courses.map((c) => [c.key, c]))

  // 미래 추천: 전공필수 또는 관련도 minScore 이상 (직무가 없으면 전공필수만 — 직무 이유가 생기지 않으므로 같은 규칙)
  const recommended = new Map()
  if (grade) {
    for (const course of courses) {
      if (completed.has(course.key) || course.year <= grade) continue
      const reasons = courseReasons(course, scoredJobs, jobRelevance, minScore)
      if (reasons.length > 0) recommended.set(course.key, reasons)
    }
  }

  // 수강 필요 (현재 학년까지): 전공필수 · 핵심 과목(3점) · 미래 추천 과목의 확인된 선수과목
  // 현재 학년 과목도 포함한다 (학기 정보가 없어 지났는지 알 수 없으므로 자동 배치하지 않고 안내만)
  const missed = new Map()
  const addMissed = (course, reason) => {
    if (!course || completed.has(course.key) || !(course.year <= grade)) return
    const list = missed.get(course.key) ?? []
    if (!list.some((r) => r.label === reason.label)) list.push(reason)
    missed.set(course.key, list)
  }
  if (grade) {
    for (const course of courses) {
      if (course.year > grade) continue
      for (const reason of courseReasons(course, scoredJobs, jobRelevance, minScore)) {
        if (reason.type === 'required' || reason.type === 'core') addMissed(course, reason)
      }
    }
    for (const key of recommended.keys()) {
      const target = byKey.get(key)
      for (const preKey of target.prerequisites ?? []) {
        addMissed(byKey.get(preKey), { type: 'prerequisite', label: `${target.title} 선수과목` })
      }
    }
  }

  const courseNodes = []
  const missedCourses = []
  for (const course of courses) {
    const base = { courseKey: course.key, title: course.title, year: course.year, semester: course.semester }
    if (completed.has(course.key)) courseNodes.push({ ...base, completed: true, reasons: [] })
    else if (recommended.has(course.key)) courseNodes.push({ ...base, completed: false, reasons: recommended.get(course.key) })
    else if (missed.has(course.key)) missedCourses.push({ ...base, reasons: missed.get(course.key) })
  }
  return { courseNodes, missedCourses }
}

// AI 길잡이 데이터 준비 (화면·DB에 접근하지 않는 순수 함수)
//
// - 로드맵 노드 → 과목·활동 목록. 로드맵에 배치된 과목을 '이수'로 단정하지 않는다.
//     완료 표시(completed) = 완료 / 학기에 배치 = 계획 / 보관함 = 아이디어(활동) 또는 계획(과목)
// - 요청 본문(payload)은 supabase/functions/recommend-career/guide.ts 형식과 같다.
// - 성적·흥미도·일기는 이 요청에만 쓰고 저장하지 않는다.

import competencies from '../../../data/course-competencies.json'
import { GRADE_OPTIONS } from '../../onboarding/careerKeywords.js'
import { BASE_CATEGORIES } from '../../roadmap/nodeCategories.js'
import { isCourse, themeLabel } from '../../roadmap/layout.js'
import { classifyFields } from '../../explore/jobField.js'
import { pickCsJobs } from '../../explore/csJobFilter.js'
import { kstToday } from '../../explore/contestInfo.js'

export const GUIDE_MODES = [
  { id: 'both', title: '진로와 추천 활동 모두 알아보기', desc: '어울리는 직무와 앞으로 할 활동을 함께 추천해요.' },
  { id: 'career', title: '나에게 어울리는 진로 찾기', desc: '지금까지의 과목·활동으로 직무 2~3개를 추천해요.' },
  { id: 'activities', title: '앞으로 할 활동 추천받기', desc: '희망 직무는 그대로 두고 다음 활동 3~5개를 추천해요.' },
]

export const GRADES = GRADE_OPTIONS.map((g) => g.id) // A+ ~ F
export const INTERESTS = [1, 2, 3, 4, 5]
export const DIARY_MAX = 5 // AI에 보낼 수 있는 일기 수
export const DIARY_CHARS = 300 // 일기 하나에서 보낼 최대 글자 수
export const MEMO_CHARS = 120 // 활동 메모에서 보낼 최대 글자 수
const MAX_ITEMS = 40
const MAX_KEYWORDS = 10

export const DIFFICULTY_LABEL = { 입문: '입문', 중급: '중급', 도전: '도전' }

// 같은 활동 이름인지 비교 (공백·기호·대소문자 무시). Edge Function guide.ts normalizeTitle과 같은 규칙
export const normalizeTitle = (t) => String(t ?? '').toLowerCase().replace(/[\s\-_·.,()[\]/]/g, '')

const short = (text, max) => {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

// 노드의 상태: 완료 / 계획 / 아이디어
function statusOf(node, course) {
  if (node.completed) return 'done'
  if (node.status === 'placed') return 'planned'
  return course ? 'planned' : 'idea'
}
export const STATUS_LABEL = { done: '완료', planned: '계획', idea: '보관함' }

// 교과목 키 찾기: 온보딩 교과목(originKey) → 같은 이름의 교과과정 과목
function courseKeyOf(node, curriculum) {
  if (isCourse(node)) return node.originKey.slice('course:'.length)
  return curriculum.courses.find((c) => c.title === node.title?.trim())?.key ?? null
}

// 로드맵 → { courses, activities }
// courses: [{ id, key, title, status }]  activities: [{ id, title, category, status, memo }]
export function collectGuideSources(nodes, documents, curriculum) {
  const courses = []
  const activities = []
  for (const node of nodes) {
    if (!node.title?.trim()) continue
    if (node.categoryId === 'memo') continue // 자유 메모는 활동이 아니므로 AI 분석에 보내지 않는다
    const course = isCourse(node) || node.theme === 'major'
    if (course) {
      courses.push({ id: node.id, key: courseKeyOf(node, curriculum), title: node.title.trim(), status: statusOf(node, true) })
    } else {
      const memo = documents?.[node.id]?.content?.body ?? ''
      activities.push({
        id: node.id,
        title: node.title.trim(),
        category: node.job ? '저장한 채용 공고' : node.contest ? '저장한 공고' : node.categoryLabel ?? themeLabel(node.theme),
        status: statusOf(node, false),
        memo: memo.trim(),
      })
    }
  }
  // 완료 → 계획 → 보관함 순으로 (개수 제한에 걸릴 때 완료한 것부터 보낸다)
  const order = { done: 0, planned: 1, idea: 2 }
  courses.sort((a, b) => order[a.status] - order[b.status])
  activities.sort((a, b) => order[a.status] - order[b.status])
  return { courses, activities }
}

// 정보 요약 (분석 전 '활용할 정보'에 보여 줄 숫자)
export function summarizeSources({ courses, activities }) {
  const count = (list, status) => list.filter((x) => x.status === status).length
  return {
    courses: courses.length,
    coursesDone: count(courses, 'done'),
    coursesPlanned: count(courses, 'planned'),
    activities: activities.length,
    activitiesDone: count(activities, 'done'),
    activitiesPlanned: count(activities, 'planned'),
    activitiesIdea: count(activities, 'idea'),
    memos: activities.filter((a) => a.memo).length,
  }
}

// 역량 키워드: 과목의 역량(course-competencies.json)에 가중치를 더한다
//   성적 입력한 완료 과목 = 성적 가중치, 성적 없는 완료 과목 = 3.0, 계획 과목 = 1.0
//   흥미도 4·5는 조금 더한다. F만 받은 키워드도 '계획' 수준으로는 남긴다 (성적만으로 진로를 배제하지 않게)
export function rankGuideKeywords(courses, scores = {}) {
  const stats = new Map()
  for (const course of courses) {
    const list = competencies.courses[course.key] ?? []
    if (list.length === 0) continue
    const s = scores[course.id] ?? {}
    let weight = course.status === 'done' ? 3.0 : 1.0
    if (course.status === 'done' && s.grade) weight = Math.max(1.0, GRADE_OPTIONS.find((g) => g.id === s.grade)?.weight ?? 3.0)
    if (s.interest >= 4) weight += s.interest - 3
    for (const keyword of new Set(list)) stats.set(keyword, (stats.get(keyword) ?? 0) + weight)
  }
  const order = (k) => competencies.keywords.indexOf(k)
  return [...stats.entries()]
    .sort(([a, x], [b, y]) => y - x || order(a) - order(b))
    .slice(0, MAX_KEYWORDS)
    .map(([k]) => k)
}

// 일기 → 보낼 발췌 (날짜 + 앞부분 300자). 화면의 '보낼 내용 미리보기'와 같은 값을 보낸다
export const diaryExcerpt = (diary) => ({ date: diary.date, text: short(diary.content, DIARY_CHARS) })

// 요청 본문 만들기
// scores: { [courseId]: { grade?, interest? } }  — 성적은 완료 과목에만 붙인다
// diaries: 사용자가 고른 일기 [{ date, content }] (동의 OFF면 빈 배열)
export function buildGuidePayload({ mode, profile, sources, scores = {}, includeMemos = true, diaries = [] }) {
  const job = profile?.interests?.find((j) => j && j !== 'undecided') ?? null
  const grade = Number.isInteger(profile?.grade) && profile.grade >= 1 && profile.grade <= 4 ? profile.grade : null
  return {
    mode,
    grade,
    currentJob: job,
    keywords: rankGuideKeywords(sources.courses, scores),
    courses: sources.courses.slice(0, MAX_ITEMS).map((c) => {
      const item = { title: short(c.title, 40), status: c.status }
      const s = scores[c.id] ?? {}
      if (c.status === 'done' && s.grade) item.grade = s.grade
      if (s.interest) item.interest = s.interest
      return item
    }),
    activities: sources.activities.slice(0, MAX_ITEMS).map((a) => {
      const item = { title: short(a.title, 40), category: short(a.category, 20), status: a.status }
      if (includeMemos && a.memo) item.memo = short(a.memo, MEMO_CHARS)
      return item
    }),
    diary: diaries.slice(0, DIARY_MAX).map(diaryExcerpt),
  }
}

// 추천 활동의 종류 → 노드 저장 값 (theme, 기본 종류 키)
export function nodeTypeOf(categoryId) {
  const category = BASE_CATEGORIES.find((c) => c.id === categoryId) ?? BASE_CATEGORIES.find((c) => c.id === 'free')
  return { theme: category.theme, categoryId: category.id, label: category.label }
}

// 로드맵에 같은 이름의 활동이 이미 있는지
export function hasSameTitle(nodes, title) {
  const key = normalizeTitle(title)
  return nodes.some((n) => normalizeTitle(n.title) === key)
}

// 추천 활동을 보관함에 넣을 때 함께 저장할 메모 (AI 추천임을 남긴다)
export function activityMemo(activity) {
  return short(`AI 길잡이 추천 · 첫 단계: ${activity.firstStep}`, 200)
}

// 추천 직무와 관련된 실제 채용 공고 (DB에 저장된 것 중 마감일이 오늘 이후인 것만)
// jobs: listOpenJobPostings 결과. 마감일이 없는 공고는 유효한지 확인할 수 없어 뺀다.
export function relatedPostings(jobs, careerKeys, { limit = 4, today = kstToday() } = {}) {
  if (!careerKeys.length) return []
  return pickCsJobs(jobs, 1000)
    .filter((job) => job.deadline && job.deadline >= today && job.url)
    .map((job) => ({ ...job, fields: classifyFields(job.title).filter((f) => careerKeys.includes(f)) }))
    .filter((job) => job.fields.length > 0)
    .slice(0, limit)
}

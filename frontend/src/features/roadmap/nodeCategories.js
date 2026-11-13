import { EXPERIENCE_GROUPS } from '../onboarding/onboardingOptions.js'
import { curriculum } from '../onboarding/courseRecommendationSlot.js'
import { isCourse, themeLabel } from './layout.js'

// ADD NODE의 NODE TYPE(카테고리)·DETAIL TYPE(세부 활동)
// - 화면에는 온보딩 경험 대분류 이름을 그대로 보여 주고, 세부 활동은 온보딩 48개 목록을 그대로 읽어 쓴다. (복사하지 않음)
// - 저장되는 값은 기존 노드 theme 7개(layout.js THEMES) 중 하나다. DB·API 계약은 바꾸지 않는다.
// - 연결 규칙은 온보딩 경험 저장(onboarding_experience_types)과 같게 맞춘다.
//   (예: 해커톤 → external, 학부연구생 → research, 자격증 → career, 휴학 → event)

// 대분류 → 기본 theme (세부 활동을 고르지 않았을 때)
const GROUP_THEME = {
  project: 'project', // 프로젝트
  contest: 'external', // 공모전·대회
  club: 'event', // 동아리·커뮤니티
  external: 'external', // 대외활동
  career: 'career', // 연구·진로
  study: 'free', // 학업·자기계발
  campus: 'event', // 교내활동
  life: 'event', // 대학생활 이벤트
}

// 세부 활동마다 대분류 기본값과 다른 theme을 써야 하는 경우만 적는다
const ITEM_THEME = {
  undergrad_research: 'research', // 학부연구생
  lab_intern: 'research', // 연구실 인턴
  certificate: 'career', // 자격증
}

// NODE TYPE 칩 목록: 전공·학업 + 온보딩 8개 대분류 + 자유
// details: DETAIL TYPE에 보여 줄 세부 활동 [{ id, title, theme }]
export const BASE_CATEGORIES = [
  { id: 'major', label: '전공·학업', theme: 'major', details: [] },
  ...EXPERIENCE_GROUPS.map((group) => ({
    id: group.id,
    label: group.title,
    theme: GROUP_THEME[group.id] ?? 'free',
    details: group.items.map((item) => ({
      id: item.id,
      dbKey: item.dbKey, // 온보딩 DB 경험 키 (있는 항목만)
      title: item.title,
      theme: ITEM_THEME[item.id] ?? GROUP_THEME[group.id] ?? 'free',
    })),
  })),
  { id: 'free', label: '자유', theme: 'free', details: [] },
]

// 같은 이름인지 (앞뒤 공백·대소문자 무시)
export function sameName(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

// ───── 이미 만든 노드의 종류 (NODE DETAILS) ─────
// 노드에는 theme만 저장되므로, 카테고리를 직접 고른 적이 없는 노드는 theme으로 대표 카테고리를 보여 준다.
const THEME_CATEGORY = {
  major: 'major',
  project: 'project',
  external: 'external',
  career: 'career',
  research: 'career', // 연구·진로
  event: 'life', // 대학생활 이벤트
  free: 'free',
}

// 온보딩 경험 노드: originKey 'experience:<경험 키>' → 카테고리·세부 활동 (제목은 보지 않는다)
// 경험 키는 온보딩 DB 키(dbKey) 또는 화면 항목 id (EXPERIENCE_GROUPS와 같은 정의)
// ※ 지금 온보딩 RPC는 경험 노드에 origin_key를 저장하지 않는다 → RPC 변경 후 동작 (그 전에는 theme 기준)
export function experienceOf(node) {
  if (!node.originKey?.startsWith('experience:')) return null
  const key = node.originKey.slice('experience:'.length)
  for (const category of BASE_CATEGORIES) {
    const detail = category.details.find((d) => d.dbKey === key || d.id === key)
    if (detail) return { categoryId: category.id, detailId: detail.id, label: category.label }
  }
  return null
}

// 노드의 현재 카테고리 id
// 우선순위: 세션에서 고른 값(categoryId) → 온보딩 경험 키(originKey) → theme에 맞는 기본 카테고리
export function nodeCategoryId(node, categories) {
  if (node.categoryId && categories.some((c) => c.id === node.categoryId)) return node.categoryId
  return experienceOf(node)?.categoryId ?? THEME_CATEGORY[node.theme] ?? 'free'
}

// 노드의 현재 세부 활동 id (모르면 null — 임의로 고르지 않는다)
// 사용자가 카테고리를 직접 고른 적이 있으면 그 선택을 따르고, 아니면 온보딩 경험 키
export function nodeDetailId(node) {
  if (node.categoryId) return node.detailId ?? null
  return experienceOf(node)?.detailId ?? null
}

// 카드에 보일 종류 이름: 고른 카테고리 → 온보딩 경험의 카테고리 → theme 이름
export function nodeKindLabel(node) {
  return node.categoryLabel ?? experienceOf(node)?.label ?? themeLabel(node.theme)
}

// ───── 전공·학업: 교과목 선택 (COURSE) ─────
// 온보딩과 같은 교과과정 데이터·과목 키(curriculum.courses)를 쓴다. 데이터가 비어 있으면 빈 목록.
// 공식 교육과정 순서(1-1 → 4-2)로, 같은 학기 안에서는 데이터 순서 그대로. 화면을 그릴 때마다 읽어서
// 4번 담당 데이터가 연결되면 자동으로 목록이 나타난다.
export function courseOptions() {
  return curriculum.courses
    .map((course, index) => ({ course, index }))
    .sort((a, b) => a.course.year - b.course.year || a.course.semester - b.course.semester || a.index - b.index)
    .map(({ course }) => course)
}

// 노드에 연결된 교과목 키: 직접 고른 값(courseKey, 세션 전용) → 온보딩 교과목 노드의 originKey 'course:<키>'
export function nodeCourseKey(node) {
  if (node.courseKey) return node.courseKey
  return isCourse(node) ? node.originKey.slice('course:'.length) : null
}

// 실제 교과목과 연결된 노드인지
export function isCourseLinked(node) {
  return isCourse(node) || Boolean(node.courseKey)
}

// 기본 종류 '전공·학업'(키 'major')인지 — 이 종류는 D-DAY를 쓰지 않는다
// - 고른 종류(categoryId)가 있으면 그 키로만 판정한다. 사용자 정의 종류는 기반 theme이 major여도 해당 없음
// - 고른 적이 없으면 온보딩 경험 키 → theme 순서 (실제 교과목은 theme major라 여기에 포함)
export function isMajorCategory(node) {
  if (node.categoryId) return node.categoryId === 'major'
  return (experienceOf(node)?.categoryId ?? THEME_CATEGORY[node.theme]) === 'major'
}

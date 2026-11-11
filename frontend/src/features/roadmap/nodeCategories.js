import { EXPERIENCE_GROUPS } from '../onboarding/onboardingOptions.js'

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

// AI 진로 추천에 보낼 역량 키워드 만들기 (브라우저 안에서만 실행)
//
// - 성적은 이 파일 안에서 가중치로만 쓰고, 밖으로 보내지 않는다. 결과는 키워드 목록뿐이다.
// - 과목 → 역량 키워드: frontend/src/data/course-competencies.json (팀 판단)
// - 키워드 점수 = 그 키워드를 가진 과목들의 등급 가중치 합 → 여러 과목의 역량이 함께 반영된다.
//   점수가 같으면 더 많은 과목에 나온 키워드, 그다음 키워드 목록 순서.
//   F(가중치 0)만 받은 키워드는 보내지 않는다.

import competencies from '../../data/course-competencies.json'

// 4.5 만점 기준 등급
export const GRADE_OPTIONS = [
  { id: 'A+', weight: 4.5 },
  { id: 'A0', weight: 4.0 },
  { id: 'B+', weight: 3.5 },
  { id: 'B0', weight: 3.0 },
  { id: 'C+', weight: 2.5 },
  { id: 'C0', weight: 2.0 },
  { id: 'D+', weight: 1.5 },
  { id: 'D0', weight: 1.0 },
  { id: 'F', weight: 0 },
]

export const MIN_GRADED_COURSES = 3 // 이 개수 이상 등급을 입력해야 추천을 받을 수 있다
export const MAX_KEYWORDS = 10 // AI에 보내는 키워드 최대 개수

const weightOf = (grade) => GRADE_OPTIONS.find((g) => g.id === grade)?.weight ?? null

// graded: [{ courseKey, grade }] → 우선순위 순 키워드 목록 (중복 없음)
export function rankKeywords(graded, max = MAX_KEYWORDS) {
  const stats = new Map() // keyword → { score, courses }
  for (const { courseKey, grade } of graded) {
    const weight = weightOf(grade)
    if (weight === null) continue
    for (const keyword of new Set(competencies.courses[courseKey] ?? [])) {
      const stat = stats.get(keyword) ?? { score: 0, courses: 0 }
      stat.score += weight
      stat.courses += 1
      stats.set(keyword, stat)
    }
  }
  const order = (keyword) => competencies.keywords.indexOf(keyword)
  return [...stats.entries()]
    .filter(([, stat]) => stat.score > 0)
    .sort(([a, sa], [b, sb]) => sb.score - sa.score || sb.courses - sa.courses || order(a) - order(b))
    .slice(0, max)
    .map(([keyword]) => keyword)
}

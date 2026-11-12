// 과목 추천 데이터·함수가 연결될 자리 (docs/API.md 4.4)
//
// - 교과과정 목록: frontend/src/data/curriculum-2026.json (2026 연계도의 공식 정보만, 48과목)
// - 아직 비어 있는 것 (4번 담당이 만들면 여기서 import로 바꾼다)
//   - frontend/src/data/job-relevance.json     (직무 관련도, 팀 판단)
//   - frontend/src/features/onboarding/selectCourses.js (미래 학년 추천 선정 함수)

import curriculumData from '../../data/curriculum-2026.json'

// courses: [{ key, title, year, semester, category, area, needsCheck }]
export const curriculum = curriculumData

export const jobRelevance = {
  basis: 'team',
  curriculumYear: 2026,
  minScore: 2,
  jobs: {},
}

// 임시 선정 함수: 사용자가 고른 이수 완료 과목만 돌려준다.
// 미래 학년 추천(직무 관련도·전공필수)은 4번의 selectCourses로 교체한다.
// 입력·출력 형식은 API.md 4.4 "선정 함수 입력·출력"과 같다.
export function selectCourses({ completedCourseKeys, curriculum }) {
  const courseNodes = curriculum.courses
    .filter((course) => completedCourseKeys.includes(course.key))
    .map((course) => ({
      courseKey: course.key,
      title: course.title,
      year: course.year,
      semester: course.semester,
      completed: true,
    }))
  return { courseNodes }
}

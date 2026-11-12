// 교과목 선정 함수 (docs/API.md 4.4 "선정 규칙"). 화면·DB에 접근하지 않는 순수 함수.
//
// 1. 이수 완료 과목: completedCourseKeys에 있는 과목 → completed: true (학년과 무관)
// 2. 미래 추천 과목: year > grade 이면서 이수하지 않은 과목 중
//    - 직무를 골랐으면: 고른 직무들 중 가장 높은 관련도 점수가 minScore 이상인 과목
//    - 직무가 없거나 '아직 정하지 않음'뿐이면: 전공필수 과목만
// 3. 그 밖의 과목은 노드를 만들지 않는다. 커리큘럼에 없는 키는 무시한다.
// 결과 순서는 교과과정 데이터 순서(학기 → 연계도 위→아래)와 같다.

export function selectCourses({ grade, completedCourseKeys = [], jobs = [], curriculum, jobRelevance }) {
  const completed = new Set(completedCourseKeys)
  const scoredJobs = jobs.filter((job) => jobRelevance.jobs[job])
  const score = (courseKey) => Math.max(0, ...scoredJobs.map((job) => jobRelevance.jobs[job][courseKey] ?? 0))
  const isRecommended = (course) =>
    scoredJobs.length > 0 ? score(course.key) >= jobRelevance.minScore : course.category === '전공필수'

  const courseNodes = []
  for (const course of curriculum.courses) {
    const isCompleted = completed.has(course.key)
    if (!isCompleted && !(grade && course.year > grade && isRecommended(course))) continue
    courseNodes.push({
      courseKey: course.key,
      title: course.title,
      year: course.year,
      semester: course.semester,
      completed: isCompleted,
    })
  }
  return { courseNodes }
}

// 계정에 저장된 노드 → 이수한 교과목 (2026 교과과정 순서)
//
// 이수 과목으로 보는 노드: 완료 표시(completed)된 노드 중
//   1) 온보딩에서 만든 교과목 노드: originKey 'course:<과목 키>'
//   2) 로드맵에서 직접 추가한 '전공·학업'(theme major) 노드 중 제목이 교과목 이름과 같은 것
//      (로드맵에서 고른 교과목 키는 저장되지 않으므로 제목으로 맞춘다)
// 화면·DB에 접근하지 않는 순수 함수.

export function completedCoursesOf(nodes, curriculum) {
  const keys = new Set()
  const titles = new Set()
  for (const node of nodes) {
    if (node.originKey?.startsWith('course:')) keys.add(node.originKey.slice('course:'.length))
    else if (node.theme === 'major' && node.title) titles.add(node.title.trim())
  }
  return curriculum.courses.filter((course) => keys.has(course.key) || titles.has(course.title))
}

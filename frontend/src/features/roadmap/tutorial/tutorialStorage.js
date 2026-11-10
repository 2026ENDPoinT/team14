// 로드맵 튜토리얼을 이미 봤는지 기록한다. (지금은 브라우저 localStorage, 나중에 계정 정보로 옮길 수 있음)
// localStorage를 쓸 수 없는 환경(사생활 보호 모드 등)에서도 오류 없이 동작하도록 try/catch로 감싼다.
const KEY = 'campusRoadmap.tutorial.roadmap'

export function hasSeenRoadmapTutorial() {
  try {
    return localStorage.getItem(KEY) === 'done'
  } catch {
    return false
  }
}

export function markRoadmapTutorialSeen() {
  try {
    localStorage.setItem(KEY, 'done')
  } catch {
    // 저장할 수 없으면 다음 접속 때 다시 보일 수 있다 (기능에는 영향 없음)
  }
}

// MY PAGE의 "사용 방법 다시 보기"에서 호출한 뒤 로드맵으로 이동하면 튜토리얼이 다시 나타난다.
export function resetRoadmapTutorial() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // 무시
  }
}

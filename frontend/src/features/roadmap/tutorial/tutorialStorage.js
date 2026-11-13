// 로드맵 튜토리얼을 이미 봤는지 기록한다. (브라우저 localStorage, 계정별)
// - 예전에는 브라우저 하나에 기록이 하나(KEY)라서, 한 사람이 보고 나면 같은 브라우저의 다른 계정은
//   처음 들어와도 튜토리얼이 자동으로 나오지 않았다 → 계정 id별 키로 나눈다.
// - 예전 기록(KEY = 'done')은 지우지 않고, 처음 확인하는 계정에게 한 번 옮겨 준다
//   (그 브라우저에서 튜토리얼을 본 사람이 그 계정일 가능성이 가장 크므로). 옮긴 뒤에는 다른 계정에 쓰지 않는다.
// - HOME 튜토리얼(campusRoadmap.tutorial.home)과는 따로 관리한다.
// localStorage를 쓸 수 없는 환경(사생활 보호 모드 등)에서도 오류 없이 동작하도록 try/catch로 감싼다.
const KEY = 'campusRoadmap.tutorial.roadmap'
const keyFor = (userId) => (userId ? `${KEY}:${userId}` : KEY) // 로그인 전(예시 로드맵)은 예전 키 그대로

export function hasSeenRoadmapTutorial(userId) {
  try {
    if (localStorage.getItem(keyFor(userId)) === 'done') return true
    if (userId && localStorage.getItem(KEY) === 'done') {
      // 예전(브라우저 하나) 기록을 이 계정으로 옮긴다. 예전 값은 '옮겼음'으로 남겨 둔다 (삭제하지 않음)
      localStorage.setItem(keyFor(userId), 'done')
      localStorage.setItem(KEY, `moved:${userId}`)
      return true
    }
    return false
  } catch {
    return false
  }
}

export function markRoadmapTutorialSeen(userId) {
  try {
    localStorage.setItem(keyFor(userId), 'done')
  } catch {
    // 저장할 수 없으면 다음 접속 때 다시 보일 수 있다 (기능에는 영향 없음)
  }
}

// 다시 보기 기록 지우기 (지금은 화면의 ? 버튼이 기록을 지우지 않고 바로 연다)
export function resetRoadmapTutorial(userId) {
  try {
    localStorage.removeItem(keyFor(userId))
  } catch {
    // 무시
  }
}

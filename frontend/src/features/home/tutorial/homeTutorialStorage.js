// HOME 튜토리얼을 이미 봤는지 기록한다. 로드맵 튜토리얼(tutorialStorage.js)과 같은 방식, 다른 키.
// (브라우저 localStorage. 쓸 수 없는 환경에서도 오류 없이 동작하도록 try/catch)
const KEY = 'campusRoadmap.tutorial.home'

export function hasSeenHomeTutorial() {
  try {
    return localStorage.getItem(KEY) === 'done'
  } catch {
    return true // 저장소를 못 쓰면 매번 자동으로 띄우지 않는다 (다시 보기 버튼으로는 볼 수 있음)
  }
}

export function markHomeTutorialSeen() {
  try {
    localStorage.setItem(KEY, 'done')
  } catch {
    // 무시
  }
}

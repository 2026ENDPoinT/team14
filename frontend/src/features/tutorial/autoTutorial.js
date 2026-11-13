import { markTutorialSeen } from '../../services/tutorial.js'

// HOME·로드맵 튜토리얼을 '신규 가입 후 각 화면 첫 방문'에만 자동으로 띄우는 규칙 (두 화면 공용)
// - 기준: 서버 프로필의 home_tutorial_seen / roadmap_tutorial_seen
//   · 가입할 때만 false로 만들어지고(migration 20261114002800), 기존 가입자는 true
//   · 칸이 아직 없으면(서버 미적용) undefined → 자동으로 띄우지 않는다 (기존 사용자에게 갑자기 뜨지 않게)
// - 자동으로 띄우는 순간 서버에 '봤음'을 저장한다 (건너뛰어도 완료). 저장에 성공했을 때만 프로필도 true로 바꾼다
// - 저장에 실패해도 같은 접속에서는 다시 자동으로 띄우지 않는다 (아래 attempted)
// - 브라우저 저장소(localStorage)는 쓰지 않는다 → 다른 기기·재로그인에서도 같은 결과
const FLAG = { home: 'homeTutorialSeen', roadmap: 'roadmapTutorialSeen' }
const attempted = new Set() // `${userId}:${kind}` 이번 접속에서 자동 실행을 시도함

export function shouldAutoStartTutorial(profile, kind) {
  if (!profile?.id) return false
  if (attempted.has(`${profile.id}:${kind}`)) return false
  return profile[FLAG[kind]] === false
}

// 자동 실행을 시작할 때 부른다. applyProfile: AuthProvider의 프로필 갱신 함수
export async function recordAutoTutorial(profile, kind, applyProfile) {
  attempted.add(`${profile.id}:${kind}`)
  const result = await markTutorialSeen(kind)
  if (!result.error) applyProfile?.({ [FLAG[kind]]: true })
  return result
}

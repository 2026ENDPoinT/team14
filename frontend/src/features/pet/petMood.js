// 펫 기분 (HOME 펫 · 마이페이지 프로필 아이콘이 같은 값을 쓴다)
// - 지난 접속(서버 출석 기록, 오늘 제외) 이후 3일 이상 → gloomy: 시들시들·시무룩한 표정
// - 7일 이상 → cold: 시무룩 + 추워서 떨고 눈물·바람 (HOME 효과)
// - 펫을 쓰다듬으면(cheerUp) 이번 접속 동안 다시 괜찮아진다. 보상·출석 규칙과는 무관 (읽기만 함)
import { useEffect, useSyncExternalStore } from 'react'
import { daysSince, getPreviousVisitDate } from '../../services/lastVisit.js'

export const GLOOMY_DAYS = 3
export const COLD_DAYS = 7

let state = { userId: null, days: null, cheered: false }
let loadingFor = null
const listeners = new Set()
const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
function setState(patch) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

// 사용자마다 한 번만 지난 접속 날짜를 읽는다 (HOME·마이페이지가 같이 써도 요청은 1번)
function load(userId) {
  if (!userId || state.userId === userId || loadingFor === userId) return
  loadingFor = userId
  getPreviousVisitDate().then((date) => {
    if (loadingFor !== userId) return
    loadingFor = null
    setState({ userId, days: daysSince(date), cheered: false })
  })
}

// 쓰다듬기: 이번 접속 동안 시무룩·추움이 풀린다
export function cheerUp() {
  if (!state.cheered) setState({ cheered: true })
}

// 화면용 훅: { gloomy, cold }
export function usePetMood(userId) {
  const snapshot = useSyncExternalStore(subscribe, () => state)
  useEffect(() => {
    load(userId)
  }, [userId])
  const days = snapshot.userId === userId && !snapshot.cheered ? snapshot.days : null
  return {
    gloomy: days !== null && days >= GLOOMY_DAYS,
    cold: days !== null && days >= COLD_DAYS,
  }
}

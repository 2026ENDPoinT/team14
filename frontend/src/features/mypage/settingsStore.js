// 마이페이지 설정 저장 (이 브라우저에만 저장: localStorage)
// [미확정] 계정별로 저장하려면 서버 테이블이 필요하다 (3번과 협의). 지금은 기기별 설정.
// localStorage를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 기본값으로 동작한다.
import { mockSettings } from './myPageMock.js'

const KEY = 'campus-roadmap:settings'

export function loadSettings() {
  try {
    return { ...mockSettings, ...JSON.parse(localStorage.getItem(KEY) || '{}') }
  } catch {
    return { ...mockSettings }
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // 저장하지 못해도 화면에서는 바뀐 값으로 계속 쓴다
  }
}

// 달력 시작 요일: 'sun' | 'mon'
export function getWeekStart() {
  return loadSettings().weekStart === 'mon' ? 'mon' : 'sun'
}

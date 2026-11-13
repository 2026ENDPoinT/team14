// 마이페이지 설정 저장 (이 브라우저에만 저장: localStorage)
// [미확정] 계정별로 저장하려면 서버 테이블이 필요하다 (3번과 협의). 지금은 기기별 설정.
// localStorage를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 기본값으로 동작한다.
import { mockSettings } from './myPageMock.js'

const KEY = 'campus-roadmap:settings'
export const THEME_CHANGED_EVENT = 'campustree:theme-changed'

// 화면 모드: 'light' | 'dark' | 'sunset'(노을). 그 밖의 값은 라이트
export const THEMES = ['light', 'dark', 'sunset']
export function getDisplayTheme() {
  const theme = loadSettings().theme
  return THEMES.includes(theme) ? theme : 'light'
}

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
    // 저장을 허용하지 않는 브라우저에서는 현재 방문에만 적용될 수 있다.
  }
  window.dispatchEvent(new Event(THEME_CHANGED_EVENT))
}

// 달력 시작 요일: 'sun' | 'mon'
export function getWeekStart() {
  return loadSettings().weekStart === 'mon' ? 'mon' : 'sun'
}

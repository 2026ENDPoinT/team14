import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'
import { AuthErrorScreen, AuthLoadingScreen } from './AuthStatusScreen.jsx'

// 로그인 화면으로 보낼 때, 인증 오류 정보(?error=…, #error=…)가 있으면 그대로 넘겨 로그인 화면에서 보여 준다
// 첫 화면('/')에 로그인하지 않고 들어오면 서비스 소개(/welcome)로 보낸다. 다른 보호된 주소는 그대로 /login
function ToLogin() {
  const location = useLocation()
  const carry = /error/.test(location.search + location.hash)
  if (!carry && location.pathname === '/') return <Navigate to="/welcome" replace />
  return <Navigate to={carry ? { pathname: '/login', search: location.search, hash: location.hash } : '/login'} replace />
}

// 공통: 확인 중·오류·비로그인·재설정 링크 처리. 통과하면 null
function commonGate(auth) {
  if (auth.status === 'loading') return <AuthLoadingScreen />
  if (auth.status === 'error' || auth.status === 'unconfigured') return <AuthErrorScreen />
  if (auth.status === 'signedOut') return <ToLogin />
  // 비밀번호 재설정 링크로 들어온 세션은 재설정 화면에서만 쓴다
  if (auth.recovery) return <Navigate to="/reset-password" replace />
  return null
}

// 내부 서비스 화면 (HOME·로드맵·일기·추억·탐색): 로그인 + 온보딩 완료 사용자만
export function RequireOnboarded({ children }) {
  const auth = useAuth()
  const blocked = commonGate(auth)
  if (blocked) return blocked
  if (!auth.profile.onboardingCompleted) return <Navigate to="/onboarding" replace />
  return children
}

// 온보딩 화면: 로그인 + 온보딩 미완료 사용자만
// 방금 저장에 성공한 사용자는 완료 화면에 머문다 ([시작하기]를 누르면 HOME)
export function RequireOnboardingPending({ children }) {
  const auth = useAuth()
  const blocked = commonGate(auth)
  if (blocked) return blocked
  if (auth.profile.onboardingCompleted && !auth.justCompleted) return <Navigate to="/" replace />
  return children
}

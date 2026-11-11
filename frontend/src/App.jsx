import { Routes, Route, Link } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import OnboardingPage from './pages/OnboardingPage.jsx'
import DiaryPage from './pages/DiaryPage.jsx'
import MemoriesPage from './pages/MemoriesPage.jsx'
import RoadmapPage from './pages/RoadmapPage.jsx'
import ExplorePage from './pages/ExplorePage.jsx'
import { AuthProvider, useAuth } from './features/auth/AuthProvider.jsx'
import { RequireOnboarded, RequireOnboardingPending } from './features/auth/RouteGuards.jsx'

// 주소(URL)와 페이지 연결. 경로는 SPEC.md 2장 기준
// 접근 규칙: 비로그인 → /login, 온보딩 미완료 → /onboarding, 완료 → 내부 화면
// /login, /reset-password는 가드 없이 연다 (Google·이메일 인증·재설정 링크 처리를 방해하지 않도록)
export default function App() {
  return (
    <AuthProvider>
      <DevNav />

      <Routes>
        <Route path="/" element={<RequireOnboarded><HomePage /></RequireOnboarded>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/onboarding" element={<RequireOnboardingPending><OnboardingPage /></RequireOnboardingPending>} />
        <Route path="/diary" element={<RequireOnboarded><DiaryPage /></RequireOnboarded>} />
        <Route path="/memories" element={<RequireOnboarded><MemoriesPage /></RequireOnboarded>} />
        <Route path="/roadmap" element={<RequireOnboarded><RoadmapPage /></RequireOnboarded>} />
        <Route path="/explore" element={<RequireOnboarded><ExplorePage /></RequireOnboarded>} />
        <Route path="*" element={<p>페이지를 찾을 수 없습니다.</p>} />
      </Routes>
    </AuthProvider>
  )
}

// 임시 이동 메뉴 (개발 확인용, 공통 레이아웃 작업 때 교체)
function DevNav() {
  const { status, logout } = useAuth()
  return (
    <nav style={{ display: 'flex', gap: 12, padding: 12 }}>
      <Link to="/">홈</Link>
      <Link to="/login">로그인</Link>
      <Link to="/onboarding">온보딩</Link>
      <Link to="/diary">일기</Link>
      <Link to="/memories">추억 보관소</Link>
      <Link to="/roadmap">로드맵</Link>
      <Link to="/explore">탐색</Link>
      {(status === 'ready' || status === 'error') && (
        <button type="button" onClick={logout}>로그아웃</button>
      )}
    </nav>
  )
}

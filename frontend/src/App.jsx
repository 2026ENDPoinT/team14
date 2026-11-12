import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import OnboardingPage from './pages/OnboardingPage.jsx'
import DiaryPage from './pages/DiaryPage.jsx'
import MemoriesPage from './pages/MemoriesPage.jsx'
import RoadmapPage from './pages/RoadmapPage.jsx'
import ExplorePage from './pages/ExplorePage.jsx'
import MyPage from './pages/MyPage.jsx'
import GlobalNav from './components/GlobalNav.jsx'
import { AuthProvider, useAuth } from './features/auth/AuthProvider.jsx'
import { RequireOnboarded, RequireOnboardingPending } from './features/auth/RouteGuards.jsx'

// 개발용 미리보기 화면: 로컬 개발 서버(npm run dev)에서만 쓴다.
// 배포 빌드에서는 import.meta.env.DEV가 false라 이 코드와 라우트가 통째로 빠진다 → 주소가 열리지 않는다.
const AiCareerPreview = import.meta.env.DEV ? lazy(() => import('./dev/AiCareerPreview.jsx')) : null

// 주소(URL)와 페이지 연결. 경로는 SPEC.md 2장 기준
// 접근 규칙: 비로그인 → /login, 온보딩 미완료 → /onboarding, 완료 → 내부 화면
// /login, /reset-password는 가드 없이 연다 (Google·이메일 인증·재설정 링크 처리를 방해하지 않도록)
export default function App() {
  return (
    <AuthProvider>
      <AppNav />

      <Routes>
        <Route path="/" element={<RequireOnboarded><HomePage /></RequireOnboarded>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/onboarding" element={<RequireOnboardingPending><OnboardingPage /></RequireOnboardingPending>} />
        <Route path="/diary" element={<RequireOnboarded><DiaryPage /></RequireOnboarded>} />
        <Route path="/memories" element={<RequireOnboarded><MemoriesPage /></RequireOnboarded>} />
        <Route path="/roadmap" element={<RequireOnboarded><RoadmapPage /></RequireOnboarded>} />
        <Route path="/explore" element={<RequireOnboarded><ExplorePage /></RequireOnboarded>} />
        <Route path="/mypage" element={<RequireOnboarded><MyPage /></RequireOnboarded>} />
        {AiCareerPreview && (
          <Route path="/dev/preview/ai-career" element={<Suspense fallback={null}><AiCareerPreview /></Suspense>} />
        )}
        <Route path="*" element={<p>페이지를 찾을 수 없습니다.</p>} />
      </Routes>
    </AuthProvider>
  )
}

// 공통 상단 메뉴: 로그인하고 온보딩을 마친 사용자에게만, 로그인·비밀번호 재설정·온보딩 화면에서는 숨긴다
// (접근 규칙 자체는 라우트 가드가 정한다. 여기서는 메뉴를 보일지만 결정)
const NAV_HIDDEN_PATHS = ['/login', '/reset-password', '/onboarding']
function AppNav() {
  const { status, profile, recovery } = useAuth()
  const { pathname } = useLocation()
  if (NAV_HIDDEN_PATHS.some((path) => pathname.startsWith(path))) return null
  if (status !== 'ready' || !profile?.onboardingCompleted || recovery) return null
  return <GlobalNav />
}

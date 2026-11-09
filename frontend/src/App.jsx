import { Routes, Route, Link } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import OnboardingPage from './pages/OnboardingPage.jsx'
import DiaryPage from './pages/DiaryPage.jsx'
import MemoriesPage from './pages/MemoriesPage.jsx'
import RoadmapPage from './pages/RoadmapPage.jsx'
import ExplorePage from './pages/ExplorePage.jsx'

// 주소(URL)와 페이지 연결. 경로는 SPEC.md 2장 기준
export default function App() {
  return (
    <>
      {/* 임시 이동 메뉴 (개발 확인용, 공통 레이아웃 작업 때 교체) */}
      <nav style={{ display: 'flex', gap: 12, padding: 12 }}>
        <Link to="/">홈</Link>
        <Link to="/onboarding">온보딩</Link>
        <Link to="/diary">일기</Link>
        <Link to="/memories">추억 보관소</Link>
        <Link to="/roadmap">로드맵</Link>
        <Link to="/explore">탐색</Link>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/diary" element={<DiaryPage />} />
        <Route path="/memories" element={<MemoriesPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="*" element={<p>페이지를 찾을 수 없습니다.</p>} />
      </Routes>
    </>
  )
}

import { Link, useLocation } from 'react-router-dom'
import './GlobalNav.css'

// 공통 상단 메뉴 (화면 위쪽 가운데 떠 있는 캡슐형 메뉴)
// - 색·그림자·움직임은 예전 로드맵 반원 메뉴(RoadmapNav)의 값을 그대로 쓴다 (GlobalNav.css)
// - 로그인·온보딩을 마친 화면에서만 App.jsx가 그린다 (로그인·비밀번호 재설정·온보딩에서는 숨김)
// - 현재 페이지는 노란색 배경 + aria-current="page"
// - 일기 영역(/diary, /memories)의 '일기 · 추억 보관소' 전환은 화면 안의 탭으로 한다 (하위 탭은 없앰)

// 작은 선형 아이콘 (stroke = 글자색)
const icon = (path) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
)
const ICONS = {
  home: icon(<><path d="M4 11.5 12 5l8 6.5" /><path d="M6.5 10v9h11v-9" /><path d="M10 19v-5h4v5" /></>),
  roadmap: icon(<><circle cx="5.5" cy="12" r="2" /><circle cx="18.5" cy="6.5" r="2" /><circle cx="18.5" cy="17.5" r="2" /><path d="M7.5 12h4l5-4.6M11.5 12l5 4.6" /></>),
  diary: icon(<><path d="M6 4.5h10.5A1.5 1.5 0 0 1 18 6v13.5H7.5A1.5 1.5 0 0 1 6 18V4.5z" /><path d="M6 18a1.5 1.5 0 0 1 1.5-1.5H18" /><path d="M9.5 8.5h5M9.5 11.5h3" /></>),
  explore: icon(<><circle cx="12" cy="12" r="8" /><path d="m15 9-1.8 4.2L9 15l1.8-4.2L15 9z" /></>),
  mypage: icon(<><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c1.2-3.3 3.9-5 7-5s5.8 1.7 7 5" /></>),
}

const MENUS = [
  { to: '/', label: '홈', icon: 'home', match: (p) => p === '/' },
  { to: '/roadmap', label: '로드맵', icon: 'roadmap', match: (p) => p.startsWith('/roadmap') },
  { to: '/explore', label: '기회 탐색', icon: 'explore', match: (p) => p.startsWith('/explore') },
  { to: '/diary', label: '추억보관소', icon: 'diary', match: (p) => p.startsWith('/diary') || p.startsWith('/memories') },
  { to: '/mypage', label: '마이페이지', icon: 'mypage', match: (p) => p.startsWith('/mypage') },
]

export default function GlobalNav() {
  const { pathname } = useLocation()

  return (
    <div className="gnav-wrap">
      <nav className="gnav" aria-label="주요 메뉴">
        <ul className="gnav__list">
          {MENUS.map((m, i) => {
            const active = m.match(pathname)
            return (
              <li key={m.to} style={{ '--i': i }}>
                <Link to={m.to} className={`gnav__item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                  {/* 아이콘+글자: 처음 나타날 때 순서대로 내려오고, 올리면 커진다 (반원 메뉴와 같은 움직임) */}
                  <span className="gnav__inner">
                    {ICONS[m.icon]}
                    <span>{m.label}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

import { Link } from 'react-router-dom'

// 상단 반원 메뉴. 기본 상태에서는 글씨가 숨겨져 있고,
// 반원(또는 메뉴 영역)에 마우스를 올리면 글씨가 나타난다. (CSS :hover로 처리)
const MENUS = [
  { label: 'EXPLORE', to: '/explore', top: 30 },
  { label: 'ROADMAP', to: '/roadmap', top: 53 },
  { label: 'HOME', to: '/', top: 61 },
  { label: 'DIARY', to: '/diary', top: 53 },
  { label: 'MYPAGE', to: null, top: 30 }, // [미확정] 마이페이지 주소가 SPEC에 없음
]

export default function RoadmapNav() {
  return (
    <nav className="rm-nav" aria-label="주요 메뉴">
      <div className="rm-nav__half" />
      <ul className="rm-nav__menu">
        {MENUS.map((menu, i) => (
          <li
            key={menu.label}
            className="rm-nav__item"
            style={{ top: menu.top, left: `${10 + i * 20}%`, '--i': i }}
          >
            {menu.to ? (
              <Link to={menu.to} className="rm-nav__link">{menu.label}</Link>
            ) : (
              <span className="rm-nav__link" title="준비 중">{menu.label}</span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}

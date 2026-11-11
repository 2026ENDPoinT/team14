import { Link } from 'react-router-dom'

// 마이페이지에서 여러 번 쓰는 작은 부품들

// 선 아이콘 (로드맵 아이콘과 같은 선 굵기)
const ICON_PATHS = {
  account: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M6.5 18.5c1.3-2.2 3.2-3.3 5.5-3.3s4.2 1.1 5.5 3.3" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  display: <><rect x="3.5" y="4.5" width="17" height="12" rx="2" /><path d="M9 20h6M12 16.5V20" /></>,
  activity: <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />,
  archive: <><rect x="3.5" y="4.5" width="17" height="4.5" rx="1.5" /><path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4" /></>,
  shield: <path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z" />,
  link: <><circle cx="12" cy="5.5" r="2.3" /><circle cx="5.5" cy="18" r="2.3" /><circle cx="18.5" cy="18" r="2.3" /><path d="M10.8 7.5l-4 8.3M13.2 7.5l4 8.3M7.8 18h8.4" /></>,
  info: <><rect x="4.5" y="3.5" width="12" height="17" rx="2" /><path d="M8 8h5M8 12h5" /><rect x="14" y="14" width="6.5" height="6.5" rx="1.5" /></>,
  logout: <><path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14" /><path d="M10 12h10M16.5 8.5L20 12l-3.5 3.5" /></>,
  leave: <><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.3-4.3" /></>,
  chevron: <path d="M9 5l7 7-7 7" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
}
export function Icon({ name, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[name]}
    </svg>
  )
}

// 오른쪽 화면 제목 (+ 하위 화면이면 왼쪽에 돌아가기 화살표)
export function PanelTitle({ title, desc, onBack }) {
  return (
    <header className="mp-panel__head">
      {onBack && (
        <button type="button" className="rm-icon-btn mp-back" aria-label="돌아가기" onClick={onBack}>
          <Icon name="back" />
        </button>
      )}
      <h1 className="mp-panel__title">{title}</h1>
      {desc && <p className="mp-panel__desc">{desc}</p>}
    </header>
  )
}

// 여러 줄을 묶는 카드 (로드맵 노드 카드 모양)
export function Group({ title, children }) {
  return (
    <section className="mp-group">
      {title && <h2 className="mp-group__title">{title}</h2>}
      <div className="mp-card">{children}</div>
    </section>
  )
}

// 한 줄: 왼쪽 이름(+설명), 오른쪽 값 또는 조작 버튼
export function Row({ label, hint, value, children }) {
  return (
    <div className="mp-row">
      <div>
        <p className="mp-row__label">{label}</p>
        {hint && <p className="mp-row__hint">{hint}</p>}
      </div>
      {children ?? <span className="mp-row__value">{value}</span>}
    </div>
  )
}

// 눌러서 이동하는 줄 (왼쪽 아이콘, 오른쪽 > 화살표)
export function LinkRow({ icon, label, hint, to, onClick, danger }) {
  const inner = (
    <>
      {icon && <span className="mp-row__icon"><Icon name={icon} /></span>}
      <div className="mp-row__text">
        <p className="mp-row__label">{label}</p>
        {hint && <p className="mp-row__hint">{hint}</p>}
      </div>
      <Icon name="chevron" size={18} />
    </>
  )
  const className = `mp-row mp-row--link ${danger ? 'is-danger' : ''}`
  return to
    ? <Link to={to} className={className}>{inner}</Link>
    : <button type="button" className={className} onClick={onClick}>{inner}</button>
}

// 켜기/끄기 스위치 (켜지면 연노랑)
export function Toggle({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`mp-toggle ${on ? 'is-on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="mp-toggle__knob" />
    </button>
  )
}

// 여러 개 중 하나 고르기
export function Segment({ value, options, onChange }) {
  return (
    <div className="mp-segment" role="radiogroup">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          className={value === key ? 'is-active' : ''}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

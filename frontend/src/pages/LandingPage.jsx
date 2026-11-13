import { useEffect, useRef } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider.jsx'
import sprout from '../assets/pets/sprout.png'
import penguin2 from '../assets/pets/penguin-2.png'
import penguin3 from '../assets/pets/penguin-3.png'
import penguin4 from '../assets/pets/penguin-4.png'
import '../features/landing/landing.css'

// 서비스 소개 랜딩 (/welcome) — momentree (Moment + Tree)
// 스크롤 스토리텔링: 장면마다 화면에 머무는(sticky) 구간을 두고, 그 구간의 스크롤 진행률(0~1)을
// CSS 변수 --p로 넘겨 페이드·이동·크기 변화를 CSS가 계산한다. (React 다시 그리기 없음, 라이브러리 없음)
// - '로그인'·'시작하기'는 기존 로그인 화면(/login)으로. 이미 로그인했으면 HOME('/')으로
// - 움직임 줄이기 설정이면 모든 장면을 완성된 모습으로 보여 준다 (CSS)

// 브랜드 심볼: 작은 점(순간)이 모여 줄기와 잎(나무)이 되는 모양
export function BrandMark({ size = 28 }) {
  return (
    <svg className="lp-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill="#8fa889" />
      <path d="M16 25V14.5" stroke="#fbf8f0" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 17.5c0-3.4 2.4-5.6 5.8-5.6 0 3.4-2.4 5.6-5.8 5.6z" fill="#fbf8f0" />
      <path d="M16 20c0-2.6-1.9-4.4-4.6-4.4 0 2.6 1.9 4.4 4.6 4.4z" fill="#fbf8f0" opacity="0.85" />
      <circle cx="16" cy="9.2" r="1.8" fill="#f6e3a8" />
    </svg>
  )
}

// 장면 2: 로드맵 — 학기 점 위로 노드가 하나씩 나타나고 선으로 이어진다 (viewBox 좌표)
const SEMESTERS = [70, 230, 390, 550]
const NODES = [
  { x: 70, y: 150, t: 0.16 },
  { x: 230, y: 70, t: 0.28 },
  { x: 230, y: 230, t: 0.36 },
  { x: 390, y: 120, t: 0.48 },
  { x: 550, y: 190, t: 0.6 },
]
const LINKS = [
  [0, 1, 0.24],
  [0, 2, 0.32],
  [1, 3, 0.44],
  [3, 4, 0.56],
]

// 장면 3: 기록 — 일기 장과 사진 몇 장이 차례로 놓인다
const MEMORIES = [
  { kind: 'page', x: -150, y: -30, r: -4, t: 0.15 },
  { kind: 'photo', x: 40, y: -110, r: 5, t: 0.28 },
  { kind: 'photo', x: 140, y: 60, r: -3, t: 0.4 },
  { kind: 'note', x: -40, y: 110, r: 2, t: 0.52 },
]

// 장면 4: 성장 — 새싹에서 어른 펫까지 (같은 펫의 실제 단계 이미지)
const GROWTH = [sprout, penguin2, penguin3, penguin4]

export default function LandingPage() {
  const { status } = useAuth()
  const rootRef = useRef(null)

  useEffect(() => {
    const before = document.title
    document.title = 'momentree · 모멘트리'
    return () => {
      document.title = before
    }
  }, [])

  // 스크롤 진행률 → CSS 변수 (--p: 장면 구간 안 진행률, --hero: 첫 화면에서 벗어난 정도)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    let raf = 0
    const update = () => {
      raf = 0
      const vh = root.clientHeight
      root.style.setProperty('--hero', Math.min(1, root.scrollTop / vh).toFixed(3))
      for (const scene of root.querySelectorAll('[data-scene]')) {
        const top = scene.offsetTop - root.scrollTop
        const range = scene.offsetHeight - vh
        const p = range > 0 ? Math.min(1, Math.max(0, -top / range)) : 1
        scene.style.setProperty('--p', p.toFixed(3))
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    root.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      root.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [status])

  if (status === 'ready') return <Navigate to="/" replace />
  if (status === 'loading') return <div className="lp" aria-busy="true" />

  return (
    <div className="lp" ref={rootRef}>
      <header className="lp-header">
        <Link to="/welcome" className="lp-brand" aria-label="momentree 처음 화면">
          <BrandMark size={22} />
          <span>momentree</span>
        </Link>
        <Link to="/login" className="lp-login">로그인</Link>
      </header>

      {/* 장면 1: 브랜드 */}
      <section className="lp-hero" aria-label="momentree">
        <div className="lp-hero__inner">
          <span className="lp-hero__mark"><BrandMark size={56} /></span>
          <h1 className="lp-wordmark">momentree</h1>
          <p className="lp-slogan">모든 순간이 모여, 나만의 길이 되도록.</p>
          <Link to="/login" className="lp-cta lp-cta--soft">시작하기</Link>
        </div>
        <span className="lp-scroll" aria-hidden="true">
          <span className="lp-scroll__line" />
        </span>
      </section>

      {/* 장면 2: 나만의 길 */}
      <section className="lp-scene" data-scene="path" aria-label="나만의 길">
        <div className="lp-stage">
          <p className="lp-line">아직 정해지지 않은 길도, 괜찮으니까.</p>
          <svg className="lp-path" viewBox="0 0 620 300" aria-hidden="true">
            <line className="lp-path__axis" x1="20" y1="150" x2="600" y2="150" />
            {SEMESTERS.map((x) => <circle key={x} className="lp-path__sem" cx={x} cy="150" r="5" />)}
            {LINKS.map(([a, b, t]) => (
              <path
                key={`${a}-${b}`}
                className="lp-path__link"
                pathLength="1"
                style={{ '--t': t }}
                d={`M ${NODES[a].x} ${NODES[a].y} C ${(NODES[a].x + NODES[b].x) / 2} ${NODES[a].y}, ${(NODES[a].x + NODES[b].x) / 2} ${NODES[b].y}, ${NODES[b].x} ${NODES[b].y}`}
              />
            ))}
            {NODES.map((n, i) => (
              <g key={i} className="lp-path__node" style={{ '--t': n.t, transformOrigin: `${n.x}px ${n.y}px` }}>
                <rect x={n.x - 34} y={n.y - 14} width="68" height="28" rx="14" />
                <circle cx={n.x - 20} cy={n.y} r="3.5" />
              </g>
            ))}
          </svg>
        </div>
      </section>

      {/* 장면 3: 순간의 기록 */}
      <section className="lp-scene" data-scene="memory" aria-label="순간의 기록">
        <div className="lp-stage">
          <p className="lp-line">지나온 하루도, 의미 있는 기록으로.</p>
          <div className="lp-memories" aria-hidden="true">
            {MEMORIES.map((m, i) => (
              <span
                key={i}
                className={`lp-memory lp-memory--${m.kind}`}
                style={{ '--t': m.t, '--x': `${m.x}px`, '--y': `${m.y}px`, '--r': `${m.r}deg` }}
              >
                {m.kind === 'page' && <><i /><i /><i /><i /></>}
                {m.kind === 'photo' && <b />}
                {m.kind === 'note' && <><i /><i /></>}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 장면 4: 함께 성장 */}
      <section className="lp-scene" data-scene="grow" aria-label="함께 성장">
        <div className="lp-stage">
          <p className="lp-line">그리고 그 모든 순간이, 성장으로.</p>
          <div className="lp-grow" aria-hidden="true">
            {GROWTH.map((src, i) => (
              <img key={src} src={src} alt="" className="lp-grow__img" style={{ '--k': i }} draggable="false" />
            ))}
          </div>
        </div>
      </section>

      {/* 장면 5: 시작 */}
      <section className="lp-end" aria-label="시작하기">
        <BrandMark size={40} />
        <h2 className="lp-end__title">당신의 다음 순간을, 모멘트리에서.</h2>
        <Link to="/login" className="lp-cta">모멘트리 시작하기</Link>
        <p className="lp-foot">momentree · Moment + Tree</p>
      </section>
    </div>
  )
}

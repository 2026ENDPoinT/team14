import { useEffect, useState } from 'react'
import './WarmthEffect.css'

// 온기(보상) 획득 연출
// 1) 0~2초: 따뜻한 연기가 동글동글 몽실몽실 피어오름
// 2) 2초: '온기 +{amount} 획득!' 배지가 뿅 나타남 (일기 +200, 출석 +100)
// 3) 3.6초: 사라지고 onDone 호출
// amount는 서버 결과 값을 그대로 보여 준다. 화면에서 온기를 직접 더하지 않는다.
// fullScreen: HOME처럼 화면 전체를 덮을 때 true (기본은 감싼 팝업 카드만 덮는다)
// title: 배지 위에 크게 보여 줄 말 (예: 출석 보상이면 '출석!'). 없으면 표시하지 않는다

// 연기 방울: x(가로 위치), s(크기), d(시작 지연), dx(흔들림)
const PUFFS = [
  { x: -60, s: 70, d: 0, dx: -18 },
  { x: 0, s: 96, d: 0.1, dx: 14 },
  { x: 58, s: 74, d: 0.2, dx: 20 },
  { x: -28, s: 60, d: 0.45, dx: -24 },
  { x: 34, s: 64, d: 0.55, dx: -12 },
  { x: -78, s: 48, d: 0.7, dx: 16 },
  { x: 74, s: 50, d: 0.8, dx: -20 },
  { x: 6, s: 82, d: 0.9, dx: 22 },
  { x: -44, s: 56, d: 1.1, dx: 12 },
  { x: 46, s: 58, d: 1.2, dx: -16 },
]
// 배지 주변으로 튀는 작은 점 (각도)
const SPARKS = [0, 50, 110, 170, 230, 290]

export default function WarmthEffect({ amount, onDone, fullScreen = false, title = '' }) {
  const [phase, setPhase] = useState('smoke') // 'smoke' → 'pop' → 'leave'

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('pop'), 2000)
    const t2 = setTimeout(() => setPhase('leave'), 3300)
    const t3 = setTimeout(onDone, 3700)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <div className={`wm-overlay ${fullScreen ? 'wm-overlay--page' : ''} ${phase === 'leave' ? 'is-leaving' : ''}`} role="status" aria-live="polite">
      <div className="wm-stage">
        <span className="wm-glow" aria-hidden="true" />
        {PUFFS.map((p, i) => (
          <span
            key={i}
            className="wm-puff"
            aria-hidden="true"
            style={{ '--x': `${p.x}px`, '--s': `${p.s}px`, '--d': `${p.d}s`, '--dx': `${p.dx}px` }}
          />
        ))}

        {phase !== 'smoke' && (
          <div className="wm-result">
            {SPARKS.map((a) => (
              <span key={a} className="wm-spark" aria-hidden="true" style={{ '--a': `${a}deg` }} />
            ))}
            {title && <p className="wm-title">{title}</p>}
            <p className="wm-badge">
              온기 <strong>+{amount.toLocaleString()}</strong> 획득!
            </p>
            <p className="wm-sub">펫이 따뜻해졌어요</p>
          </div>
        )}
      </div>
    </div>
  )
}

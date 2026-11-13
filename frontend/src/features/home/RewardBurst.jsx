import { useLayoutEffect, useRef, useState } from 'react'

// 온기 지급 연출: 펫 위로 "+100 온기"가 떠오르고, 작은 햇살 조각들이 오른쪽 위 온기 표시로 날아가
// 도착하면 온기 표시가 살짝 반짝인다. 서버가 지급을 확인한 경우에만 띄운다 (rewardQueue).
// amount: 지급된 온기, onDone: 연출이 끝나면 호출 (약 1.9초)
// originRef: 시작 위치 요소(펫), targetRef: 도착 위치 요소(온기 표시). 없으면 화면 가운데 → 오른쪽 위
// onSeen: 0.9초 동안 보였을 때 (이후 화면을 떠나도 다시 보여 주지 않게)
const SUNS = [
  { dx: -46, dy: -18, d: 0 },
  { dx: -18, dy: -40, d: 0.05 },
  { dx: 14, dy: -30, d: 0.1 },
  { dx: 40, dy: -12, d: 0.15 },
  { dx: -30, dy: 14, d: 0.2 },
  { dx: 26, dy: 18, d: 0.25 },
]
const DURATION = 1900

const centerOf = (el, fallback) => {
  const r = el?.getBoundingClientRect()
  if (!r || (r.width === 0 && r.height === 0)) return fallback
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

export default function RewardBurst({ amount, onDone, onSeen, originRef, targetRef }) {
  const [points, setPoints] = useState(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const seenRef = useRef(onSeen)
  seenRef.current = onSeen

  // 그리기 직전에 시작·도착 위치를 잰다 (화면 픽셀 좌표, position: fixed 기준)
  useLayoutEffect(() => {
    const from = centerOf(originRef?.current, { x: window.innerWidth / 2, y: window.innerHeight * 0.45 })
    const to = centerOf(targetRef?.current, { x: window.innerWidth - 60, y: 40 })
    // 배지는 펫 얼굴을 가리지 않게 펫 영역의 위쪽(머리 위)에서 떠오른다
    const r = originRef?.current?.getBoundingClientRect()
    const label = r && r.height > 0 ? { x: from.x, y: r.top + r.height * 0.2 } : { x: from.x, y: from.y - 80 }
    setPoints({ from, to, label })

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // 햇살이 도착할 즈음 온기 표시를 살짝 키웠다 돌린다 (Web Animations: 다시 그리기 없음)
    const pulse = !reduced && targetRef?.current?.animate
      ? setTimeout(() => {
        targetRef.current?.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.1)', offset: 0.4 }, { transform: 'scale(1)' }],
          { duration: 420, easing: 'ease-out' },
        )
      }, 1150)
      : null
    const timer = setTimeout(() => doneRef.current(), reduced ? 1200 : DURATION)
    const seen = setTimeout(() => seenRef.current?.(), 900)
    return () => {
      clearTimeout(timer)
      clearTimeout(seen)
      if (pulse) clearTimeout(pulse)
    }
  }, [originRef, targetRef])

  return (
    <div className="hm-burst" role="status" aria-live="polite">
      {points && (
        <>
          <span className="hm-burst__text" style={{ left: points.label.x, top: points.label.y }}>
            +{amount.toLocaleString()} 온기
          </span>
          {SUNS.map((s, i) => (
            <span
              key={i}
              className="hm-burst__sun"
              aria-hidden="true"
              style={{
                left: points.from.x,
                top: points.from.y,
                '--sx': `${s.dx}px`,
                '--sy': `${s.dy}px`,
                '--tx': `${points.to.x - points.from.x}px`,
                '--ty': `${points.to.y - points.from.y}px`,
                '--d': `${s.d}s`,
              }}
            />
          ))}
        </>
      )}
    </div>
  )
}

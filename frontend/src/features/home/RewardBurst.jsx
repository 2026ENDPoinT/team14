import { useEffect } from 'react'

// 온기 지급 알림: "+100 온기" 글자와 은은한 파티클. 서버가 지급을 확인한 경우에만 띄운다.
// amount: 지급된 온기, onDone: 연출이 끝나면 호출 (약 1.6초)
const PARTICLES = Array.from({ length: 8 }, (_, i) => i)

export default function RewardBurst({ amount, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1600)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div className="hm-burst" role="status" aria-live="polite">
      {PARTICLES.map((i) => (
        <span key={i} className="hm-burst__dot" style={{ '--a': `${i * 45}deg` }} aria-hidden="true" />
      ))}
      <span className="hm-burst__text">+{amount.toLocaleString()} 온기</span>
    </div>
  )
}

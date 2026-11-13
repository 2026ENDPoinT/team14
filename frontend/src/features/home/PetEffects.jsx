import { useEffect, useState } from 'react'

// HOME 펫 위에 겹쳐 그리는 효과 (원본 PNG는 그대로, CSS/SVG만)
// - soilKey: 새싹을 누를 때마다 바뀌는 번호 → 흙 알갱이가 바닥에서 톡 튀었다 떨어진다 (새싹일 때만 넘겨 받음)
// - cold: 오래(7일 이상) 못 본 뒤 첫 방문 → 눈물·바람선 (떨림은 Home.css .hm-pet.is-cold)
// 위치는 펫 그림 상자 기준 비율이라 화면·펫 크기가 달라도 함께 맞춰진다

// 그림별 눈 위치 [왼쪽 눈 x, 오른쪽 눈 x, 눈 y] (그림 폭·높이에 대한 비율, 대략값)
const EYES = {
  sprout: [0.44, 0.56, 0.66],
  'black_cat-2': [0.38, 0.57, 0.41], 'black_cat-3': [0.42, 0.58, 0.4], 'black_cat-4': [0.43, 0.57, 0.33],
  'hamster-2': [0.4, 0.58, 0.42], 'hamster-3': [0.4, 0.57, 0.4], 'hamster-4': [0.41, 0.56, 0.38],
  'otter-2': [0.49, 0.6, 0.42], 'otter-3': [0.45, 0.6, 0.33], 'otter-4': [0.44, 0.55, 0.38],
  'penguin-2': [0.4, 0.6, 0.38], 'penguin-3': [0.38, 0.62, 0.38], 'penguin-4': [0.45, 0.58, 0.3],
  'rabbit-2': [0.38, 0.6, 0.55], 'rabbit-3': [0.4, 0.58, 0.48], 'rabbit-4': [0.43, 0.57, 0.44],
}
const DEFAULT_EYES = [0.4, 0.6, 0.4]

// 흙 알갱이 8개: 좌우로 퍼지는 거리(px)·튀는 높이(px)·크기(px)·시작 지연(s)
const SOIL = [
  [-34, -30, 6, 0], [-22, -42, 5, 0.03], [-12, -26, 4, 0.06], [-4, -36, 5, 0.02],
  [6, -40, 4, 0.05], [14, -28, 6, 0.01], [26, -38, 5, 0.04], [36, -24, 4, 0.07],
]

export default function PetEffects({ hostRef, assetName, soilKey = 0, cold = false }) {
  const [box, setBox] = useState(null) // 펫 그림의 위치·크기 (hostRef 기준)

  // 그림 크기가 바뀌면(화면 크기·성장 단계) 다시 잰다
  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    let img = null
    const measure = () => {
      img = host.querySelector('img')
      if (!img) return setBox(null)
      const h = host.getBoundingClientRect()
      const r = img.getBoundingClientRect()
      setBox({ left: r.left - h.left, top: r.top - h.top, width: r.width, height: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(host)
    if (img) ro.observe(img)
    img?.addEventListener('load', measure)
    return () => {
      ro.disconnect()
      img?.removeEventListener('load', measure)
    }
  }, [hostRef, assetName])

  if (!box || (!cold && !soilKey)) return null
  const [lx, rx, ey] = EYES[assetName] ?? DEFAULT_EYES

  return (
    <span className="hm-fx" aria-hidden="true" style={box}>
      {soilKey > 0 && (
        <span key={soilKey} className="hm-soil">
          {SOIL.map(([dx, up, size, delay], i) => (
            <i key={i} style={{ '--dx': `${dx}px`, '--up': `${up}px`, width: size, height: size, animationDelay: `${delay}s` }} />
          ))}
        </span>
      )}
      {cold && (
        <>
          <span className="hm-tear" style={{ left: `${lx * 100}%`, top: `${ey * 100}%` }} />
          <span className="hm-tear is-late" style={{ left: `${rx * 100}%`, top: `${ey * 100}%` }} />
          <svg className="hm-wind" viewBox="0 0 200 100" preserveAspectRatio="none">
            <path className="hm-wind__line" d="M0 30 q30 -8 60 0 t60 0" />
            <path className="hm-wind__line is-2" d="M0 58 q30 -8 60 0 t60 0" />
            <path className="hm-wind__line is-3" d="M0 80 q25 -6 50 0 t50 0" />
          </svg>
        </>
      )}
    </span>
  )
}

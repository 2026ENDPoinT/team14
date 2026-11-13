import { useEffect, useState } from 'react'
import SadBrows from '../pet/SadBrows.jsx'
import SadTint from '../pet/SadTint.jsx'
import FrozenPet from '../pet/FrozenPet.jsx'

// HOME 펫 위에 겹쳐 그리는 효과 (원본 PNG는 그대로, CSS/SVG만)
// - soilKey: 새싹을 누를 때마다 바뀌는 번호 → 흙더미 양 끝에서 흙 알갱이가 불꽃·물줄기처럼 흩뿌려진다 (새싹일 때만 넘겨 받음)
// - cold: 오래(7일 이상) 못 본 뒤 → 꽁꽁 언 모습(FrozenPet: 테두리 얼음·언 눈물·처진 입) + 바람선. 펫은 움직이지 않음
// - brows: 3일 이상 못 봤을 때 시무룩한 눈썹 (시무룩한 그림 파일이 있으면 HomePage가 false로 넘긴다)
// - tintSrc: 3일 이상 못 봤을 때 머리 위부터 파랗게 (지금 보이는 그림 주소, 그림 모양대로 칠함)
// - frozenSrc: 7일 이상일 때 얼음을 만들 그림 주소 / frozenFace: false면 처진 입·언 눈물 생략(시무룩 그림 파일을 쓸 때)
// 위치는 펫 그림 상자 기준 비율이라 화면·펫 크기가 달라도 함께 맞춰진다

// 그림별 눈 위치는 features/pet/petFace.js (시무룩한 눈썹과 같이 쓴다)

// 흙 알갱이: 펫(흙더미)의 왼쪽 끝·오른쪽 끝에서 불꽃·스프링클러 물줄기처럼 부채꼴로 흩뿌려진다
// 한쪽에 10알. 각도(수평에서 위로, 도)·거리(px)·크기(px)·시작 지연(s)
// → 알갱이 모양(동그라미)은 그대로, 부채꼴로 날아갔다가 포물선을 그리며 아래로 떨어지고 사라진다
const SPRAY = [
  [12, 70, 5, 0], [22, 84, 4, 0.02], [30, 62, 6, 0.03], [38, 92, 4, 0.05], [46, 74, 5, 0.06],
  [54, 58, 4, 0.08], [62, 80, 6, 0.09], [70, 52, 4, 0.11], [78, 66, 5, 0.12], [86, 46, 4, 0.14],
]
const SIDES = [
  { side: 'left', dir: -1 },
  { side: 'right', dir: 1 },
]
// 알갱이 하나의 CSS 변수: 날아갈 거리(--dx 옆, --up 위)
function sprayStyle([angle, dist, size, delay], dir) {
  const rad = (angle * Math.PI) / 180
  return {
    '--dx': `${(Math.cos(rad) * dist * dir).toFixed(1)}px`,
    '--up': `${(-Math.sin(rad) * dist).toFixed(1)}px`,
    width: size,
    height: size,
    animationDelay: `${delay}s`,
  }
}

export default function PetEffects({ hostRef, assetName, soilKey = 0, cold = false, brows = false, tintSrc = null, frozenSrc = null, frozenFace = true }) {
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

  if (!box || (!cold && !soilKey && !brows && !tintSrc)) return null

  return (
    <span className="hm-fx" aria-hidden="true" style={box}>
      {tintSrc && <SadTint src={tintSrc} />}
      {cold && frozenSrc && <FrozenPet src={frozenSrc} assetName={assetName} face={frozenFace} />}
      {brows && <SadBrows assetName={assetName} />}
      {soilKey > 0 && (
        <span key={soilKey}>
          {SIDES.map(({ side, dir }) => (
            <span key={side} className={`hm-soil is-${side}`}>
              {SPRAY.map((line, i) => (
                <i key={i} style={sprayStyle(line, dir)} />
              ))}
            </span>
          ))}
        </span>
      )}
      {cold && (
        <>
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

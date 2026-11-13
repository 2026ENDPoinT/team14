import { useEffect, useState } from 'react'
import { eyesOf, mouthOf } from './petFace.js'
import { getFrozenArt } from './frozenArt.js'
import './petMood.css'

// 꽁꽁 언 펫 (7일 이상 미접속): 펫 그림 위에 겹쳐 그린다 (원본 그림은 그대로, 움직임 없음)
// - 펫 테두리를 따라 두꺼운 얼음, 맺힌 채 얼어붙은 눈물, 아래로 처진 입꼬리
// - face=false면(시무룩 그림 파일을 쓸 때) 입·눈물은 그리지 않는다
// 부모는 펫 그림과 같은 크기·위치의 상자여야 한다
export default function FrozenPet({ src, assetName, face = true }) {
  const [art, setArt] = useState(null)
  const mouth = mouthOf(assetName)
  const [lx, rx, ey] = eyesOf(assetName)

  useEffect(() => {
    let alive = true
    setArt(null)
    if (src) getFrozenArt(src, mouth).then((result) => alive && setArt(result))
    return () => {
      alive = false
    }
  }, [src, assetName]) // eslint-disable-line react-hooks/exhaustive-deps

  const [mx, my, mw] = mouth
  return (
    <span className="pm-frozen" aria-hidden="true">
      {face && art?.skin && (
        <span
          className="pm-mouth-patch"
          style={{ left: `${mx * 100}%`, top: `${my * 100}%`, width: `${mw * 150}%`, height: `${mw * 130 * art.aspect}%`, background: art.skin }}
        />
      )}
      {face && <span className="pm-frown" style={{ left: `${mx * 100}%`, top: `${(my + 0.01) * 100}%`, width: `${mw * 100}%` }} />}
      {face && [lx, rx].map((x) => <span key={x} className="pm-tear-ice" style={{ left: `${x * 100}%`, top: `${(ey + 0.04) * 100}%` }} />)}
      {art && (
        <img
          className="pm-ice"
          src={art.iceUrl}
          alt=""
          style={{ left: `${-art.padX * 100}%`, top: `${-art.padY * 100}%`, width: `${(1 + art.padX * 2) * 100}%`, height: `${(1 + art.padY * 2) * 100}%` }}
        />
      )}
    </span>
  )
}

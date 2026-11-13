import { eyesOf } from './petFace.js'
import './petMood.css'

// 시무룩한 눈썹: 펫 그림 위, 두 눈 바로 위에 안쪽 끝이 올라간 눈썹(八자)을 겹쳐 그린다 (원본 그림은 그대로)
// 부모는 펫 그림과 같은 크기·위치의 상자여야 한다 (위치는 그림 폭·높이 비율)
export default function SadBrows({ assetName }) {
  const [lx, rx, ey] = eyesOf(assetName)
  const gap = (rx - lx) * 0.42 // 눈썹 길이: 두 눈 사이 거리에 맞춰서
  const top = `${(ey - 0.08) * 100}%` // 눈보다 조금 위 (그림 높이의 8%)
  return (
    <span className="pm-brows" aria-hidden="true">
      <span className="pm-brow is-left" style={{ left: `${lx * 100}%`, top, width: `${gap * 100}%` }} />
      <span className="pm-brow is-right" style={{ left: `${rx * 100}%`, top, width: `${gap * 100}%` }} />
    </span>
  )
}

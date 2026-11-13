import './petMood.css'

// 머리 위부터 파랗게 질리는 효과: 펫 그림 모양(mask) 안에서만, 위는 진하고 아래로 갈수록 옅게
// 위에서부터 스르륵 내려온다. 부모는 펫 그림과 같은 크기·위치의 상자여야 한다
// src: 지금 보이는 펫 그림 주소 (그림 모양대로 칠하려고 씀)
export default function SadTint({ src }) {
  if (!src) return null
  return <span className="pm-tint" aria-hidden="true" style={{ '--pm-mask': `url("${src}")` }} />
}

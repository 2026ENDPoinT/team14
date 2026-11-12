// HOME 하단 성장 표시 (Figma 점선 그대로: 왼쪽 큰 검은 원 → 작은 점 15개 → 끝의 작은 원·큰 원)
// 좌표는 Figma 1440×900 화면에서 잰 값 그대로 쓰고, viewBox로 화면 폭에 맞춰 줄인다.
// - 왼쪽 큰 원 = 지금 단계의 시작, 끝의 두 원 = 다음 단계 목표
// - 현재 단계 안의 진행률만큼 앞쪽 점이 진하게(Figma 색), 남은 점은 옅게
// - 4단계(최대)면 모든 점이 진하고 끝의 두 원이 채워진다
const DOT_X = [558, 578, 598, 618, 638, 656, 676, 696, 716, 736, 756, 776, 794, 814, 834]
const ROW_Y = 713.5

export default function GrowthDots({ progress, maxed, label }) {
  const filled = maxed ? DOT_X.length : Math.round((Math.min(100, Math.max(0, progress)) / 100) * DOT_X.length)
  return (
    <svg
      className="hm-growth"
      viewBox="500 688 428 72"
      role="img"
      aria-label={label}
      data-filled={filled}
      data-maxed={maxed ? 'true' : 'false'}
    >
      <title>{label}</title>
      <circle cx="523.5" cy={ROW_Y} r="15" fill="#000" />
      {DOT_X.map((x, i) => (
        <circle key={x} className={i < filled ? 'is-on' : 'is-off'} cx={x} cy={ROW_Y - 0.5} r="2.5" fill="#696969" />
      ))}
      <circle className="hm-growth__goal" cx="869" cy="706" r="9.5" fill={maxed ? '#000' : 'none'} stroke="#7d7d7d" strokeWidth="1" />
      <circle className="hm-growth__goal" cx="899" cy="733.5" r="19.5" fill={maxed ? '#000' : 'none'} stroke="#7d7d7d" strokeWidth="1" />
    </svg>
  )
}

import { getStageByNumber } from './petStages.js'

// 펫 단계별 임시 이미지 (2-18)
// 외형 디자인이 [미확정]이라 단계가 구분되는 단순 도형으로 둔다.
// 확정되면 이 컴포넌트 안의 그림만 실제 이미지로 바꾸면 된다.
// 색은 currentColor(글자색)를 따라가므로, tokens.css 적용 시 부모의 color만 바꾸면 된다.
export default function PetImage({ stage = 1, size = 160 }) {
  const info = getStageByNumber(stage)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`펫 ${info.stage}단계: ${info.name}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    >
      {info.stage === 1 && (
        // 1단계 알: 세로로 긴 타원 + 금
        <>
          <ellipse cx="50" cy="55" rx="26" ry="34" />
          <path d="M30 55 l8 -6 l8 6 l8 -6 l8 6 l8 -6" />
        </>
      )}

      {info.stage >= 2 && (
        // 2~4단계 공통: 몸통(단계가 오를수록 커짐) + 눈
        <>
          <circle cx="50" cy="60" r={[0, 0, 22, 28, 32][info.stage]} />
          <circle cx="42" cy="56" r="2.5" fill="currentColor" />
          <circle cx="58" cy="56" r="2.5" fill="currentColor" />
        </>
      )}

      {info.stage === 2 && (
        // 2단계 아기: 머리 위 껍질 조각
        <path d="M36 42 l7 -6 l7 6 l7 -6 l7 6" />
      )}

      {info.stage >= 3 && (
        // 3~4단계: 귀
        <>
          <path d="M32 40 L28 22 L44 34" />
          <path d="M68 40 L72 22 L56 34" />
        </>
      )}

      {info.stage === 4 && (
        // 4단계 성체: 꼬리 + 웃는 입
        <>
          <path d="M82 66 q12 -4 8 -18" />
          <path d="M44 68 q6 6 12 0" />
        </>
      )}
    </svg>
  )
}

// 활동 종류(카테고리)별 작은 선 아이콘 — 로드맵 카드에서 쓰고, 나중에 추억 보관소 활동 카드에서도 같이 쓴다
// - 키는 기본 종류 id (nodeCategories.js의 BASE_CATEGORIES). 화면 이름이 아니라 키로 고른다
// - 사용자 정의 종류는 기반 종류(theme)로 키를 정해서 넘긴다 (예: nodeCategoryId(node, BASE_CATEGORIES))
// - 모르는 키면 기본 아이콘(자유: 반짝임)
// - 선 굵기·끝 모양은 로드맵 아이콘(features/roadmap/icons.jsx)과 같다. 색은 글자색(currentColor)을 따른다
const PATHS = {
  // 전공·학업: 학사모
  major: (
    <>
      <path d="M2.5 9.5 12 5l9.5 4.5L12 14z" />
      <path d="M6.5 11.8v3.7c1.5 1.5 3.4 2.3 5.5 2.3s4-.8 5.5-2.3v-3.7" />
      <path d="M21.5 9.5v4.5" />
    </>
  ),
  // 프로젝트: 코드
  project: <path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M13.5 5.5l-3 13" />,
  // 공모전·대회: 트로피
  contest: (
    <>
      <path d="M8 4.5h8v4.5a4 4 0 0 1-8 0z" />
      <path d="M8 6.5H5.5A2.5 2.5 0 0 0 8.2 10M16 6.5h2.5a2.5 2.5 0 0 1-2.7 3.5" />
      <path d="M12 13v4M8.5 19.5h7" />
    </>
  ),
  // 동아리·커뮤니티: 사람들
  club: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 18.5c.8-2.8 2.9-4.3 5.5-4.3s4.7 1.5 5.5 4.3" />
      <path d="M15.5 5.8a3 3 0 0 1 0 5.4M17 14.5c1.8.5 3 1.8 3.5 4" />
    </>
  ),
  // 대외활동: 깃발
  external: (
    <>
      <path d="M5.5 20.5v-16" />
      <path d="M5.5 5h11l-2 3.5 2 3.5h-11" />
    </>
  ),
  // 연구·진로: 돋보기(탐색)
  career: (
    <>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 4.5 4.5" />
    </>
  ),
  // 학업·자기계발: 연필
  study: (
    <>
      <path d="M4.5 19.5h4l10-10-4-4-10 10z" />
      <path d="m12.5 7.5 4 4" />
    </>
  ),
  // 교내활동: 학교
  campus: (
    <>
      <path d="M3.5 9.5 12 4.5l8.5 5" />
      <path d="M5.5 9v10h13V9" />
      <path d="M10 19v-4.5h4V19M3 19h18" />
    </>
  ),
  // 대학생활 이벤트: 달력
  life: (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  // 자유: 반짝임 (기본 아이콘)
  free: (
    <>
      <path d="M11 5c.6 3.6 2.1 5.1 5.7 5.7-3.6.6-5.1 2.1-5.7 5.7-.6-3.6-2.1-5.1-5.7-5.7C8.9 10.1 10.4 8.6 11 5z" />
      <path d="M18 4v3.5M16.25 5.75h3.5" />
    </>
  ),
}

export const CATEGORY_ICON_KEYS = Object.keys(PATHS)

export default function CategoryIcon({ categoryId, size = 14, className = '' }) {
  const key = PATHS[categoryId] ? categoryId : 'free'
  return (
    <svg
      className={className}
      data-category-icon={key}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[key]}
    </svg>
  )
}

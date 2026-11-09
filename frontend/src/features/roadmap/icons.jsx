// 로드맵에서 쓰는 선 아이콘 (피그마 아이콘을 단순화)
const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const PlusIcon = (p) => (
  <svg {...base} {...p}><path d="M12 4v16M4 12h16" /></svg>
)
export const CloseIcon = (p) => (
  <svg {...base} {...p}><path d="M5 5l14 14M19 5L5 19" /></svg>
)
export const NodeIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="4" width="16" height="14" rx="4" />
    <path d="M18 15v6M15 18h6" />
  </svg>
)
export const ConnectIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="6" cy="6" r="2" />
    <path d="M6 8v8M16.5 7.5C12 9 8 12 7.5 16.5" />
  </svg>
)
export const SemesterIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="16" height="15" rx="2" />
    <path d="M3 10h16M8 3v4M14 3v4M18 15v6M15 18h6" />
  </svg>
)
export const SaveIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M5 3h11l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 1-2z" />
    <path d="M8 3v5h7V3M7 21v-7h10v7" />
  </svg>
)
export const TrashIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14M10 10v7M14 10v7" />
  </svg>
)
export const ClipIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7" />
  </svg>
)

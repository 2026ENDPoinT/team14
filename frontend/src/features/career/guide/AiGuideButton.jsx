// 로드맵 상단 '종류 필터' 옆의 [AI 길잡이] 버튼
export function SparkleIcon({ size = 14 }) {
  return (
    <svg className="ag-sparkle" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
      <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </svg>
  )
}

export default function AiGuideButton({ open, onClick }) {
  return (
    <button type="button" className={`ag-entry ${open ? 'is-open' : ''}`} aria-expanded={open} aria-haspopup="dialog" onClick={onClick}>
      <SparkleIcon />
      AI 길잡이
    </button>
  )
}

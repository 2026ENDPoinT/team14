import { deadlineBadge } from './contestInfo.js'
import './deadlineBadge.css'

// 마감 배지 (D-7~D-1·D-day 빨강 / D-8 이상 기본 / 마감). 마감일이 없으면 아무것도 그리지 않는다.
export default function DeadlineBadge({ deadline, status, small = false }) {
  const badge = deadlineBadge(deadline, { status })
  if (!badge) return null
  return (
    <span className={`deadline-badge is-${badge.tone} ${small ? 'is-small' : ''}`} data-tone={badge.tone}>
      {badge.label}
    </span>
  )
}

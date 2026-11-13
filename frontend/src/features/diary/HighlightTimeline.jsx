import { useState } from 'react'
import { THEMES } from '../roadmap/layout.js'
import { activityDate } from './activities.js'

const HIGHLIGHT_THEMES = THEMES.filter((t) => t.id !== 'major')

// '1학년 2학기' → '1-2' (그 밖의 기간은 이름 그대로)
function shortName(period) {
  const m = /^(\d)학년 (\d)학기$/.exec(period.name)
  return m ? `${m[1]}-${m[2]}` : period.name
}

// 로드맵의 주요 활동을 학기 순서대로 보여 주는 가로 타임라인 (읽기만)
// nodes: 주요 활동 노드(activities.js useActivities) / onOpen(node): 카드를 눌렀을 때
export default function HighlightTimeline({ periods: allPeriods, nodes, documents, onOpen }) {
  const [filter, setFilter] = useState('all') // 'all' | 테마 id

  // 학기에 배치된 노드만 (보관함 노드는 학기가 없어 뺀다)
  const highlights = nodes.filter((n) => n.periodId)
  const shown = highlights.filter((n) => filter === 'all' || n.theme === filter)
  // 활동이 있는 학기만 순서대로 (빈 학기는 숨겨 한눈에 보이게)
  const periods = [...allPeriods]
    .sort((a, b) => a.order - b.order)
    .filter((p) => shown.some((n) => n.periodId === p.id))
  // 노드가 하나라도 있는 종류만 칩으로 보여 준다
  const usedThemes = HIGHLIGHT_THEMES.filter((t) => highlights.some((n) => n.theme === t.id))
  const countOf = (themeId) => highlights.filter((n) => n.theme === themeId).length

  return (
    <div className="hl">
      {/* 테마 거르기 */}
      <div className="hl-filters" role="tablist" aria-label="활동 종류">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="전체" count={highlights.length} />
        {usedThemes.map((t) => (
          <FilterChip
            key={t.id}
            active={filter === t.id}
            onClick={() => setFilter(t.id)}
            label={t.label}
            count={countOf(t.id)}
          />
        ))}
      </div>

      {/* 학기 타임라인 (넓으면 가로로 스크롤) */}
      <div className="hl-scroll">
        <ol className="hl-track">
          {periods.map((period) => {
            const nodes = shown.filter((n) => n.periodId === period.id)
            return (
              <li key={period.id} className="hl-col">
                <div className="hl-col__head">
                  <span className={`hl-col__dot ${nodes.length > 0 ? 'is-filled' : ''}`} aria-hidden="true" />
                  <span className="hl-col__badge">{shortName(period)}</span>
                  {period.type !== 'semester' && <span className="hl-col__type">{period.name}</span>}
                </div>
                <div className="hl-col__cards">
                  {nodes.map((n) => (
                    <HighlightCard key={n.id} node={n} doc={documents[n.id]} onOpen={() => onOpen(n)} />
                  ))}
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      {shown.length === 0 && <p className="rm-muted hl-none">아직 학기에 놓은 활동이 없어요. 로드맵에 프로젝트·공모전 같은 노드를 추가해 보세요.</p>}
    </div>
  )
}

function FilterChip({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`hl-chip ${active ? 'is-active' : ''}`}
      onClick={onClick}
    >
      {label}
      <span className="hl-chip__count">{count}</span>
    </button>
  )
}

function HighlightCard({ node, doc, onOpen }) {
  const theme = THEMES.find((t) => t.id === node.theme)
  const date = activityDate(node)
  return (
    <button type="button" className="hl-card" onClick={onOpen} title={date ? '그날 일기 보기' : '로드맵에서 보기'}>
      <span className="hl-card__top">
        <span className="hl-card__icon" aria-hidden="true"><ThemeIcon theme={node.theme} /></span>
        <span className="hl-card__theme">{theme?.label}</span>
        <span className={`hl-card__status ${node.completed ? 'is-done' : ''}`}>
          {node.completed ? '완료' : '계획'}
        </span>
      </span>
      <strong className="hl-card__title">{node.title}</strong>
      {typeof doc?.content?.body === 'string' && doc.content.body && <span className="hl-card__body">{doc.content.body}</span>}
      {date && <span className="hl-card__date">{date.replaceAll('-', '. ')}</span>}
    </button>
  )
}

// 테마별 작은 선 아이콘 (로드맵 아이콘과 같은 선 굵기)
function ThemeIcon({ theme }) {
  const paths = {
    external: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3', // 트로피
    career: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16', // 가방
    research: 'M2 9l10-5 10 5-10 5-10-5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5', // 학사모
    event: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z', // 별
    project: 'M8 6l-6 6 6 6M16 6l6 6-6 6', // 코드 괄호
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[theme] ?? 'M12 12m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0'} />
    </svg>
  )
}

import { isPill } from './layout.js'
import { ddayInfo, usesSourceDeadline } from './dday.js'
import { BASE_CATEGORIES, isCourseLinked, isMajorCategory, nodeCategoryId, nodeKindLabel } from './nodeCategories.js'
import CategoryIcon from '../../components/CategoryIcon.jsx'
import { contestKindLabel, sourceName } from '../explore/contestInfo.js'

// 노드 카드. 교과목·타임라인 위 노드는 작은 카드, 나머지는 종류·이름·부가 정보 카드
// subtitle: 노드 문서의 첫 줄 (한 줄 부가 정보)
// 왼쪽 점 = 완료 상태 표시등 (completed: true 노란색 / false 회색)
// 종류 표시: 고른 카테고리 이름(categoryLabel, 세션 전용) → 온보딩 경험의 카테고리 → theme 이름 (nodeKindLabel)
// D-DAY: 모든 노드가 같은 오른쪽 위 작은 태그·같은 계산(ddayInfo, 한국 시간)을 쓴다 (전공·학업 종류·교과목과 연결한 노드는 표시하지 않음. 값은 지우지 않음)
//   - 일반 노드: 개인 목표일(dueDate) / 탐색에서 가져온 노드: 원본 공고 마감일 (마감 지나거나 원본이 '마감'이면 '마감', 흐리게)
// 종류 아이콘: 종류 이름 왼쪽. 기본 종류 키로 고르고, 사용자 정의 종류는 기반 종류(theme)의 아이콘 (components/CategoryIcon.jsx)
// hideDot: 캔버스에서는 클릭 가능한 표시등(CompleteDot)을 따로 그리므로 숨긴다
export default function NodeCard({
  node, subtitle, onClick, small = false, hideDot = false, style, className: extra = '', onPointerDown,
}) {
  const course = isPill(node) // 교과목, 또는 타임라인 위의 전공·학업 노드
  const className = [
    'rm-card',
    course ? 'rm-card--course' : '',
    small ? 'rm-card--small' : '',
    `rm-theme-${node.theme}`,
    extra,
  ].join(' ')
  const dday = isCourseLinked(node) || isMajorCategory(node) ? null : nodeDday(node)
  const dueText = usesSourceDeadline(node) ? '마감일' : '목표일'

  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => onClick?.(node.id)}
      onPointerDown={onPointerDown}
    >
      {!small && !hideDot && <span className={`rm-card__dot ${node.completed ? 'is-done' : ''}`} />}
      {dday && (
        <span className={`rm-dday is-${dday.tone} ${node.completed ? 'is-done' : ''}`} title={`${dueText} ${dday?.date ?? ''}`}>
          {dday.label}
        </span>
      )}
      {course ? (
        <strong className="rm-card__title">{node.title}</strong>
      ) : node.contest ? (
        // 탐색에서 추가한 대외활동 노드: 종류 자리에 실제 공고 분류(공모전·멘토링 등), 부가 정보 자리에 출처 (마감은 위 D-DAY 태그)
        <>
          <span className="rm-card__kind rm-card__kind--contest">
            <CategoryIcon categoryId={node.contest.sourceTag === '공모전' ? 'contest' : 'external'} className="rm-card__icon" />
            {contestKindLabel(node.contest.sourceTag)}
          </span>
          <strong className="rm-card__title">{node.title}</strong>
          <span className="rm-card__sub">{sourceName(node.contest.source)}</span>
        </>
      ) : node.job ? (
        // 탐색에서 추가한 채용 노드: 종류 자리에 '채용', 부가 정보 자리에 기업명·출처 (마감은 위 D-DAY 태그)
        <>
          <span className="rm-card__kind rm-card__kind--contest">
            <CategoryIcon categoryId="career" className="rm-card__icon" />
            채용
          </span>
          <strong className="rm-card__title">{node.title}</strong>
          <span className="rm-card__sub">{node.job.company ?? '기업명 정보 없음'} · {sourceName(node.job.source)}</span>
        </>
      ) : (
        <>
          <span className="rm-card__kind">
            <CategoryIcon categoryId={nodeCategoryId(node, BASE_CATEGORIES)} className="rm-card__icon" />
            {nodeKindLabel(node)}
          </span>
          <strong className="rm-card__title">{node.title}</strong>
          {/* 기록이 있으면 첫 줄만, 없으면 비워 둔다 (카드 크기는 그대로, 종류·이름이 가운데) */}
          {subtitle && <span className="rm-card__sub">{subtitle}</span>}
        </>
      )}
    </button>
  )
}

// 노드의 D-DAY { label, tone, date } (없으면 null). 계산은 일반 노드와 같은 ddayInfo
function nodeDday(node) {
  if (!usesSourceDeadline(node)) {
    const info = ddayInfo(node.dueDate)
    return info && { ...info, date: node.dueDate }
  }
  const date = node.contest?.deadline ?? node.job?.deadline ?? null
  const info = ddayInfo(date)
  // 원본 공고가 마감됐거나 마감일이 지났으면 기존처럼 '마감' (지난 날짜와 같은 흐린 모양)
  if (node.contest?.sourceStatus === '마감' || info?.tone === 'past') return { label: '마감', tone: 'past', date: date ?? '' }
  return info && { ...info, date }
}

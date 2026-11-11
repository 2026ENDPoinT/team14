import { isPill } from './layout.js'
import { ddayInfo } from './dday.js'
import { BASE_CATEGORIES, isCourseLinked, isMajorCategory, nodeCategoryId, nodeKindLabel } from './nodeCategories.js'
import CategoryIcon from '../../components/CategoryIcon.jsx'
import DeadlineBadge from '../explore/DeadlineBadge.jsx'
import { sourceName } from '../explore/contestInfo.js'

// 노드 카드. 교과목·타임라인 위 노드는 작은 카드, 나머지는 종류·이름·부가 정보 카드
// subtitle: 노드 문서의 첫 줄 (한 줄 부가 정보)
// 왼쪽 점 = 완료 상태 표시등 (completed: true 노란색 / false 회색)
// 종류 표시: 고른 카테고리 이름(categoryLabel, 세션 전용) → 온보딩 경험의 카테고리 → theme 이름 (nodeKindLabel)
// D-DAY: dueDate가 있으면 오른쪽 위 작은 태그 (전공·학업 종류·교과목과 연결한 노드는 표시하지 않음. 값은 지우지 않음) (D-7~D-DAY 빨강 / 그 외 회색 / 지난 날짜·완료 노드는 흐리게)
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
  const dday = isCourseLinked(node) || isMajorCategory(node) ? null : ddayInfo(node.dueDate)

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
        <span className={`rm-dday is-${dday.tone} ${node.completed ? 'is-done' : ''}`} title={`목표일 ${node.dueDate}`}>
          {dday.label}
        </span>
      )}
      {course ? (
        <strong className="rm-card__title">{node.title}</strong>
      ) : node.contest ? (
        // 탐색에서 추가한 공모전 노드: 종류 자리에 '공모전'과 마감 배지, 부가 정보 자리에 출처
        <>
          <span className="rm-card__kind rm-card__kind--contest">
            <CategoryIcon categoryId="contest" className="rm-card__icon" />
            공모전 <DeadlineBadge deadline={node.contest.deadline} status={node.contest.sourceStatus} small={small} />
          </span>
          <strong className="rm-card__title">{node.title}</strong>
          <span className="rm-card__sub">{sourceName(node.contest.source)}</span>
        </>
      ) : (
        <>
          <span className="rm-card__kind">
            <CategoryIcon categoryId={nodeCategoryId(node, BASE_CATEGORIES)} className="rm-card__icon" />
            {nodeKindLabel(node)}
          </span>
          <strong className="rm-card__title">{node.title}</strong>
          <span className="rm-card__sub">{subtitle || '한 줄 부가 정보'}</span>
        </>
      )}
    </button>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { getRoadmap, listNodeCategories } from '../../services/api.js'
import { isFootprintReady } from '../../services/diary.js'
import { BASE_CATEGORIES, nodeCategoryId } from '../roadmap/nodeCategories.js'
import { periodLabel } from '../roadmap/layout.js'
import './Footprint.css'

// 일기 팝업의 '오늘의 발자취' (선택 작성)
// - 오늘 배운 것·진행한 활동을 짧게 적는다 (보상 글자 수에는 들어가지 않음)
// - 아래 종류 칩(로드맵 노드 종류: 전공·학업, 프로젝트, 대외활동 …)을 고르면 그 종류의 내 노드가 뜨고,
//   하나를 골라 이 일기에 연결할 수 있다 (diaries.linked_node_id)
// - 노드는 로드맵 조회(getRoadmap)로 읽기만 한다. 노드를 바꾸지 않는다.
// props: text·onTextChange(발자취 글), nodeId·onNodeChange(연결한 노드 id), readOnly(읽기 상태)
//        extra: 발자취 입력칸 아래에 붙일 내용 (일기 창의 AI 회고 질문)
export const FOOTPRINT_MAX = 2000
export default function FootprintField({ text, onTextChange, nodeId, onNodeChange, readOnly, extra = null }) {
  const roadmap = useMyNodes()
  const [categoryId, setCategoryId] = useState(null) // 펼친 종류

  // 종류 목록: 기본 종류 + 내가 만든 종류 중, 노드가 1개 이상 있는 것만
  const categories = useMemo(() => {
    const all = [...BASE_CATEGORIES, ...roadmap.customCategories.map((c) => ({ id: c.id, label: c.name }))]
    return all
      .map((c) => ({ ...c, nodes: roadmap.nodes.filter((n) => nodeCategoryId(n, all) === c.id) }))
      .filter((c) => c.nodes.length > 0)
  }, [roadmap.nodes, roadmap.customCategories])

  const linkedNode = roadmap.nodes.find((n) => n.id === nodeId) ?? null
  const openCategory = categories.find((c) => c.id === categoryId) ?? null

  // 노드가 놓인 곳: 학기 이름 또는 보관함
  function placeOf(node) {
    if (node.status !== 'placed') return '보관함'
    const period = roadmap.periods.find((p) => p.id === node.periodId)
    return period ? periodLabel(period) : ''
  }

  // 읽기 상태: 쓴 내용과 연결한 활동만 보여 준다
  if (readOnly) {
    if (!text && !nodeId) return null
    return (
      <section className="fp-card" aria-label="오늘의 발자취">
        <h3 className="fp-card__title"><SproutIcon /> 오늘의 발자취</h3>
        {text && <p className="fp-text">{text}</p>}
        {nodeId && (
          <p className="fp-linked">
            <span className="fp-linked__label">연결한 활동</span>
            <span className="fp-linked__name">{linkedNode?.title ?? (roadmap.status === 'loading' ? '불러오는 중…' : '삭제된 활동')}</span>
          </p>
        )}
      </section>
    )
  }

  return (
    <section className="fp-card" aria-label="오늘의 발자취">
      <div className="fp-card__head">
        <h3 className="fp-card__title"><SproutIcon /> 오늘의 발자취</h3>
        <span className="fp-card__optional">선택 작성</span>
      </div>

      {/* 일기 입력칸과 같은 모양 (글을 쓰면 왼쪽 점이 노랗게) */}
      <div className="dy-node dy-node--top">
        <span className={`dy-node__dot ${text.trim() ? 'is-done' : ''}`} aria-hidden="true" />
        <textarea
          className="dy-input dy-textarea fp-input"
          value={text}
          maxLength={FOOTPRINT_MAX}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="오늘 배운 것, 진행한 활동, 작은 성취를 기록해 보세요."
          aria-label="오늘의 발자취"
        />
      </div>
      {/* 서버에 발자취 칸이 아직 없을 때 (migration 적용 전): 글은 저장되지 않는다고 미리 알려 준다 */}
      {!isFootprintReady() && (
        <p className="rm-muted fp-note">발자취 글 저장은 서버 준비 중이에요. 지금은 연결한 활동만 저장돼요.</p>
      )}
      {extra}

      {/* 연결한 활동 (× 로 연결 해제) */}
      {nodeId && (
        <p className="fp-linked">
          <span className="fp-linked__label">연결한 활동</span>
          <span className="fp-linked__name">{linkedNode?.title ?? '불러오는 중…'}</span>
          <button type="button" className="fp-linked__remove" aria-label="활동 연결 해제" onClick={() => onNodeChange(null)}>×</button>
        </p>
      )}

      {/* 종류 칩 → 누르면 그 종류의 내 노드 목록 */}
      {roadmap.status === 'loading' && <p className="rm-muted fp-note">로드맵 활동을 불러오는 중…</p>}
      {roadmap.status === 'error' && <p className="rm-muted fp-note">로드맵 활동을 불러오지 못했어요. 발자취 글은 그대로 저장할 수 있어요.</p>}
      {roadmap.status === 'ready' && categories.length === 0 && (
        <p className="rm-muted fp-note">로드맵에 활동을 추가하면 여기서 골라 연결할 수 있어요.</p>
      )}
      {categories.length > 0 && (
        <div className="fp-chips" role="group" aria-label="활동 종류">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`fp-chip ${c.id === categoryId ? 'is-active' : ''}`}
              aria-pressed={c.id === categoryId}
              onClick={() => setCategoryId(c.id === categoryId ? null : c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {openCategory && (
        <ul className="fp-nodes" aria-label={`${openCategory.label} 활동`}>
          {openCategory.nodes.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                className={`fp-node ${node.id === nodeId ? 'is-selected' : ''}`}
                aria-pressed={node.id === nodeId}
                onClick={() => onNodeChange(node.id === nodeId ? null : node.id)}
              >
                <span className={`fp-node__dot ${node.completed ? 'is-done' : ''}`} aria-hidden="true" />
                <span className="fp-node__title">{node.title}</span>
                <span className="fp-node__place">{placeOf(node)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// 내 로드맵 노드·사용자 정의 종류를 한 번 불러온다 (읽기 전용)
function useMyNodes() {
  const [state, setState] = useState({ status: 'loading', nodes: [], periods: [], customCategories: [] })
  useEffect(() => {
    let alive = true // 팝업을 닫은 뒤 도착한 응답은 버린다
    Promise.all([getRoadmap(), listNodeCategories()]).then(([roadmap, categories]) => {
      if (!alive) return
      if (roadmap.error) {
        setState({ status: 'error', nodes: [], periods: [], customCategories: [] })
        return
      }
      setState({
        status: 'ready',
        nodes: roadmap.data.nodes.filter((n) => n.status === 'placed' || n.status === 'stored'),
        periods: roadmap.data.periods,
        customCategories: categories.data ?? [], // 종류 조회만 실패하면 기본 종류로 보여 준다
      })
    })
    return () => {
      alive = false
    }
  }, [])
  return state
}

function SproutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20v-8" />
      <path d="M12 12c0-3.5-2.5-6-6.5-6 0 3.5 2.5 6 6.5 6z" />
      <path d="M12 14c0-3 2.2-5.5 6-5.5 0 3-2.2 5.5-6 5.5z" />
    </svg>
  )
}

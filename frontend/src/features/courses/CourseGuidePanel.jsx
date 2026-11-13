import { useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider.jsx'
import { completedCoursesOf } from '../career/completedCourses.js'
import { curriculum, jobRelevance } from '../onboarding/courseRecommendationSlot.js'
import { selectCourses } from '../onboarding/selectCourses.js'
import { TIMELINE_Y, cardSize, placeNode } from '../roadmap/layout.js'
import { addCourseToRoadmap } from '../../services/courses.js'
import { moveNodes } from '../../services/api.js'
import './courseGuide.css'

// 로드맵 '수강 필요' 안내 (작업표 4-9)
// - 놓친 저학년 과목: 프로필(학년·희망 직무)과 지금 로드맵의 이수 완료 과목으로 selectCourses를 다시 계산한다.
//   → 저장하지 않으므로 새로고침·직무 변경 뒤에도 항상 최신 기준으로 보인다.
// - 과거 학기에 자동으로 넣지 않는다. 사용자가 [보관함에 추가] 또는 앞으로 들을 학기를 고르면 그때 만든다.
//   과목 키(origin_key)로 같은 과목은 한 개만 (add_course_to_roadmap RPC). 이미 있으면 위치만 알려 준다.
// - 추천 이유: 로드맵에 있는 남은 학년 추천 과목이 왜 추천됐는지도 함께 보여 준다.
// props
//   nodes, periods, layout: 로드맵 화면의 현재 값 / enabled: 로그인(DB 모드)일 때만
//   onAdded(node): 새로 만든(또는 이미 있던) 노드를 화면에 반영 / onToast(text)
export default function CourseGuidePanel({ nodes, periods, layout, enabled, onAdded, onToast }) {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [busyKey, setBusyKey] = useState(null)
  const inFlight = useRef(new Set()) // 같은 과목 연속 클릭 막기
  const grade = profile?.grade ?? null
  const jobs = profile?.interests ?? []

  const { missed, recommendedWithReasons } = useMemo(() => {
    if (!grade) return { missed: [], recommendedWithReasons: [] }
    const completedKeys = completedCoursesOf(nodes.filter((n) => n.completed), curriculum).map((c) => c.key)
    const result = selectCourses({ grade, completedCourseKeys: completedKeys, jobs, curriculum, jobRelevance })
    const nodeOf = (key) => nodes.find((n) => n.originKey === `course:${key}`)
    return {
      missed: result.missedCourses.map((c) => ({ ...c, node: nodeOf(c.courseKey) })),
      // 로드맵에 들어 있는 남은 학년 추천 과목의 이유
      recommendedWithReasons: result.courseNodes.filter((c) => !c.completed && nodeOf(c.courseKey)),
    }
  }, [grade, jobs.join(','), nodes]) // eslint-disable-line react-hooks/exhaustive-deps

  // 앞으로 들을 학기: 현재 학년부터 (학기 정보가 없어서 현재 학년 두 학기를 모두 보여 준다)
  const futurePeriods = periods.filter((p) => p.type === 'semester' && grade && p.order >= (grade - 1) * 2)
  const periodName = (id) => periods.find((p) => p.id === id)?.name ?? '학기'
  const pending = missed.filter((c) => !c.node).length

  if (!enabled || !grade || (missed.length === 0 && recommendedWithReasons.length === 0)) return null

  async function add(course, periodId = null) {
    if (inFlight.current.has(course.courseKey)) return
    inFlight.current.add(course.courseKey)
    setBusyKey(course.courseKey)
    const result = await addCourseToRoadmap({ courseKey: course.courseKey, title: course.title, periodId })
    let node = result.data?.node
    if (node && result.data.created && periodId) {
      // 학기에 배치: 로드맵 배치 규칙으로 타임라인 선 위 빈자리를 찾아 위치를 저장한다
      const col = layout.cols[periodId]
      const spot = col && placeNode(node, { x: col.x + 16, y: TIMELINE_Y - cardSize(node).h / 2 }, nodes, layout)
      if (spot) {
        const moved = await moveNodes([{ id: node.id, periodId: spot.periodId, position: spot.position }])
        if (!moved.error) node = { ...node, periodId: spot.periodId, position: spot.position }
      }
    }
    inFlight.current.delete(course.courseKey)
    setBusyKey(null)
    if (result.error) return onToast(`${course.title}을(를) 추가하지 못했어요. ${result.error.message}`)
    onAdded(node)
    if (!result.data.created) onToast(`${course.title}은(는) 이미 로드맵에 있어요.`)
    else onToast(periodId ? `${course.title}을(를) ${periodName(periodId)}에 배치했어요.` : `${course.title}을(를) 보관함에 담았어요.`)
  }

  return (
    <div className={`cg ${open ? 'is-open' : ''}`}>
      <button type="button" className="cg__toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        수강 필요{pending > 0 && <span className="cg__count">{pending}</span>}
      </button>
      {open && (
        <section className="cg__panel" aria-label="수강 필요 과목">
          <div className="cg__head">
            <strong>수강 필요</strong>
            <button type="button" className="cg__close" onClick={() => setOpen(false)} aria-label="닫기">✕</button>
          </div>
          {missed.length > 0 ? (
            <>
              <p className="cg__lead">{grade}학년 이전 권장 과목 중 아직 듣지 않은 필수·핵심 과목이에요. 지난 학기에 자동으로 넣지 않아요.</p>
              <ul className="cg__list">
                {missed.map((c) => (
                  <li key={c.courseKey} className="cg__item" data-course={c.courseKey}>
                    <div className="cg__title">
                      <span>{c.title}</span>
                      <span className="cg__term">{c.year}-{c.semester} 권장</span>
                    </div>
                    <div className="cg__reasons">
                      {c.reasons.map((r) => <span key={r.label} className={`cg__reason is-${r.type}`}>{r.label}</span>)}
                    </div>
                    {c.node ? (
                      <p className="cg__state">{c.node.status === 'stored' ? '보관함에 있어요' : `${periodName(c.node.periodId)}에 있어요`}</p>
                    ) : (
                      <div className="cg__actions">
                        <button type="button" className="cg__btn" disabled={busyKey === c.courseKey} onClick={() => add(c)}>
                          보관함에 추가
                        </button>
                        <select
                          className="cg__select"
                          aria-label={`${c.title} 배치할 학기`}
                          value=""
                          disabled={busyKey === c.courseKey || futurePeriods.length === 0}
                          onChange={(e) => e.target.value && add(c, e.target.value)}
                        >
                          <option value="">학기에 배치…</option>
                          {futurePeriods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="cg__lead">놓친 필수·핵심 과목이 없어요.</p>
          )}
          {recommendedWithReasons.length > 0 && (
            <>
              <p className="cg__sub">로드맵의 추천 과목 이유</p>
              <ul className="cg__list cg__list--plain">
                {recommendedWithReasons.map((c) => (
                  <li key={c.courseKey} className="cg__item">
                    <div className="cg__title"><span>{c.title}</span><span className="cg__term">{c.year}-{c.semester}</span></div>
                    <div className="cg__reasons">
                      {c.reasons.map((r) => <span key={r.label} className={`cg__reason is-${r.type}`}>{r.label}</span>)}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  )
}

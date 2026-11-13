// 추억 보관소에서 쓰는 "주요 활동" (로드맵 노드 읽기 전용)
// - 로드맵 조회(services getRoadmap)로 내 노드를 읽기만 한다. 노드를 바꾸지 않는다.
// - 주요 활동 = 교과목·전공 노드를 뺀 나머지 (프로젝트, 공모전·대외활동, 인턴십·진로, 연구·진학 등)
import { useEffect, useState } from 'react'
import { getRoadmap } from '../../services/api.js'
import { isCourse } from '../roadmap/layout.js'

export function isHighlight(node) {
  return node.theme !== 'major' && !isCourse(node)
}

// 활동 날짜 'YYYY-MM-DD' (없으면 null)
// 1) 노드 목표일(dueDate) — [미확정] DB에 아직 저장되지 않음(3번 due_date 연결 후 사용)
// 2) 탐색에서 추가한 공모전·채용 공고의 마감일
export function activityDate(node) {
  return node.dueDate || node.contest?.deadline || node.job?.deadline || null
}

// 날짜 → 그날의 활동 목록 { '2026-11-15': [node, ...] }
export function groupByDate(nodes) {
  const map = {}
  nodes.forEach((node) => {
    const date = activityDate(node)
    if (date) (map[date] ??= []).push(node)
  })
  return map
}

// 화면용 훅: 처음 그릴 때 한 번 불러온다. { status, error, periods, nodes, documents }
export function useActivities() {
  const [state, setState] = useState({ status: 'loading', error: null, periods: [], nodes: [], documents: {} })

  useEffect(() => {
    let alive = true // 화면을 벗어난 뒤 도착한 응답은 버린다
    getRoadmap().then((result) => {
      if (!alive) return
      if (result.error) {
        setState({ status: 'error', error: result.error, periods: [], nodes: [], documents: {} })
        return
      }
      const { periods, nodes, documents } = result.data
      setState({ status: 'ready', error: null, periods, nodes: nodes.filter(isHighlight), documents })
    })
    return () => {
      alive = false
    }
  }, [])

  return state
}

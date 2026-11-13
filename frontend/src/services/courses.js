import { supabase } from './supabaseClient.js'

// 교과목 노드 추가 (로드맵 '수강 필요' → 보관함 또는 학기)
// RPC add_course_to_roadmap (migration 20261113002000): origin_key 'course:<과목 키>'로 같은 과목은 한 개만.
// input: { courseKey, title, periodId? } — periodId가 없으면 보관함
// 결과: { data: { node, created } } 또는 { error: { code, message } }
//   created=false면 이미 있던 같은 과목 노드를 돌려준 것 (새로 만들지 않음)

const CODES = ['UNAUTHENTICATED', 'VALIDATION_ERROR', 'NOT_FOUND']

// DB nodes 행 → 로드맵 화면 노드 (services/api.js toRoadmapNode와 같은 모양, 과목 노드에 필요한 칸만)
function toCourseNode(row) {
  const placed = row.status === 'placed'
  return {
    id: row.id,
    title: row.title,
    theme: row.theme,
    periodId: row.period_id,
    position: placed ? { x: row.position_x, y: row.position_y } : null,
    status: row.status,
    source: row.source,
    originKey: row.origin_key,
    completed: row.completed,
    createdAt: row.created_at,
    categoryId: row.category_id ?? row.category_key ?? null,
    detailId: row.detail_key ?? null,
    contestId: null,
    contest: null,
    jobPostingId: null,
    job: null,
    branchVisibility: null,
  }
}

export async function addCourseToRoadmap({ courseKey, title, periodId = null }) {
  if (!supabase) return { error: { code: 'SERVER_ERROR', message: 'Supabase 연결 설정(.env)이 없습니다.' } }
  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return { error: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' } }

  const { data, error } = await supabase.rpc('add_course_to_roadmap', {
    p_course_key: courseKey,
    p_title: title,
    p_period_id: periodId,
  })
  if (error) {
    const code = CODES.includes(error.message) ? error.message : 'SERVER_ERROR'
    return { error: { code, message: code === 'SERVER_ERROR' ? '과목을 추가하지 못했어요. 잠시 후 다시 시도해 주세요.' : error.details || error.message } }
  }
  return { data: { node: toCourseNode(data.node), created: data.created } }
}

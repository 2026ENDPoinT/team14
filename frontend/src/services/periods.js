import { supabase } from './supabaseClient.js'

// 로드맵 학기 추가 (휴학 · 군휴학 · 교환학생 · 기타)
// RPC insert_timeline_period (migration 20261113002100, 기타 이름은 20261114002300)
// - 기존 학기의 id·이름은 그대로, 순서만 뒤로 민다. 끼워 넣기와 순서 변경은 DB에서 한 번에 처리한다.
// - requestId가 같으면 다시 불러도 새로 만들지 않는다 (저장 버튼 반복 클릭·재시도)
// input: { type: 'leave'|'military'|'exchange'|'custom', afterPeriodId: 학기 id 또는 null(맨 끝), requestId, name? }
//   name: 기타(custom)일 때만. 앞뒤 공백을 뺀 1~10자 (서버도 같은 규칙으로 다시 검사)
// 결과: { data: { period, created, periods } } — periods는 내 학기 전체(순서대로, services/api.js toPeriod와 같은 모양)

export const PERIOD_TYPES = [
  { type: 'leave', label: '휴학' },
  { type: 'military', label: '군휴학' },
  { type: 'exchange', label: '교환학생' },
  { type: 'custom', label: '기타' },
]
export const CUSTOM_NAME_MAX = 10

const CODES = ['UNAUTHENTICATED', 'VALIDATION_ERROR', 'NOT_FOUND']
const toPeriod = (row) => ({ id: row.id, type: row.type, name: row.name, order: row.sort_order })

export async function insertPeriod({ type, afterPeriodId = null, requestId, name = null }) {
  if (!supabase) return { error: { code: 'SERVER_ERROR', message: 'Supabase 연결 설정(.env)이 없습니다.' } }
  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return { error: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' } }

  const { data, error } = await supabase.rpc('insert_timeline_period', {
    p_type: type,
    p_after_period_id: afterPeriodId,
    p_request_id: requestId,
    p_name: type === 'custom' ? name : null,
  })
  if (error) {
    const code = CODES.includes(error.message) ? error.message : 'SERVER_ERROR'
    return { error: { code, message: code === 'SERVER_ERROR' ? '학기를 추가하지 못했어요. 잠시 후 다시 시도해 주세요.' : error.details || error.message } }
  }
  return { data: { period: toPeriod(data.period), created: data.created, periods: data.periods.map(toPeriod) } }
}

// 로드맵 학기(기간) 삭제 — RPC delete_timeline_period (migration 20261114003100)
// - 그 학기에 배치된 노드(교과목·활동·메모)는 지우지 않고 보관함으로 옮긴다. 관계선·문서·사진·첨부는 그대로
// - 노드 이동·학기 삭제·남은 학기 순서 정리를 서버가 한 번에 한다 (중간 실패 시 전부 취소)
// - 이미 지워진 학기면 deleted: false (다시 불러도 안전)
// 결과: { data: { deleted, movedNodeIds, periods } }
export async function deletePeriod(periodId) {
  if (!supabase) return { error: { code: 'SERVER_ERROR', message: 'Supabase 연결 설정(.env)이 없습니다.' } }
  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return { error: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' } }

  const { data, error } = await supabase.rpc('delete_timeline_period', { p_period_id: periodId })
  if (error) {
    if (error.code === 'PGRST202') return { error: { code: 'NOT_READY', message: '학기 삭제 기능이 아직 서버에 준비되지 않았어요.' } }
    const code = CODES.includes(error.message) ? error.message : 'SERVER_ERROR'
    return { error: { code, message: code === 'SERVER_ERROR' ? '학기를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.' : error.details || error.message } }
  }
  return { data: { deleted: data.deleted, movedNodeIds: data.moved_node_ids ?? [], periods: data.periods.map(toPeriod) } }
}

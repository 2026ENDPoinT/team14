import { supabase } from './supabaseClient.js'

// 지난 접속 날짜 (HOME 펫 '오래 못 봤어요' 상태용, 읽기만 함)
// - 기준: 서버 보상 이력의 출석 기록(reward_events type='attendance', ref_id = KST 날짜 'YYYY-MM-DD')
//   HOME을 열 때마다 서버 RPC check_in이 하루 한 번 남기는 기록이라 브라우저 저장소보다 믿을 수 있다
// - 오늘 출석은 빼고 '오늘 이전의 가장 최근 날짜'를 찾는다 → 오늘 출석이 먼저 기록돼도 지난 접속을 놓치지 않음
// - 기록이 없거나(새 사용자·예시 화면) 읽기 실패면 null → 화면은 평소 상태
const kstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)

export async function getPreviousVisitDate() {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('reward_events')
    .select('ref_id')
    .eq('type', 'attendance')
    .lt('ref_id', kstToday())
    .order('ref_id', { ascending: false })
    .limit(1)
  if (error || !data?.length) return null
  return data[0].ref_id
}

// 지난 접속 이후 지난 날 수 (KST 날짜 기준). 기록이 없으면 null
export function daysSince(dateText) {
  if (!dateText) return null
  const ms = Date.parse(`${kstToday()}T00:00:00Z`) - Date.parse(`${dateText}T00:00:00Z`)
  return Number.isFinite(ms) ? Math.round(ms / 86400000) : null
}

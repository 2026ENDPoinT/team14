import { supabase } from './supabaseClient.js'
import { toPet, toServiceError } from './rewards.js'

// 일기 서비스 (docs/API.md 4.6, docs/backend-diary-reward.md)
// - 작성·수정은 save_diary RPC로만 한다. 일기 저장과 보상 판정이 한 트랜잭션이라 저장이 실패하면 보상도 없다.
// - 삭제는 본인 일기만 (RLS). 받은 보상 이력은 지우지 않는다.

// DB diaries 행 → 화면용
function toDiary(row) {
  return {
    id: row.id,
    date: row.date,
    mood: row.mood,
    content: row.content,
    photoUrls: row.photo_urls ?? [],
    linkedNodeId: row.linked_node_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function requireSession() {
  if (!supabase) return { code: 'SERVER_ERROR', message: 'Supabase 연결 설정(.env)이 없습니다.' }
  const { data } = await supabase.auth.getSession()
  return data.session ? null : { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' }
}

// 내 일기 전체 (날짜 오름차순)
export async function listMyDiaries() {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  const { data, error } = await supabase
    .from('diaries')
    .select('id, date, mood, content, photo_urls, linked_node_id, created_at, updated_at')
    .order('date', { ascending: true })
  if (error) return { error: toServiceError(error, '일기를 불러오지 못했어요.') }
  return { data: data.map(toDiary) }
}

// 오늘(KST) 일기 온기를 이미 받았는지 (안내 문구용. 실제 판정은 서버)
export async function hasDiaryRewardOn(date) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  const { count, error } = await supabase
    .from('reward_events')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'diary_first_of_day')
    .eq('ref_id', date)
  if (error) return { error: toServiceError(error) }
  return { data: count > 0 }
}

// 작성/수정: { date, content } → { data: { diary, reward: { rewarded, energy?, reason? }, pet } } 또는 { error }
export async function saveDiary({ date, content, mood = null, linkedNodeId = null }) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  const { data, error } = await supabase.rpc('save_diary', {
    p_date: date,
    p_content: content,
    p_mood: mood,
    p_linked_node_id: linkedNodeId,
  })
  if (error) return { error: toServiceError(error, '일기를 저장하지 못했어요. 다시 시도해 주세요.') }
  return { data: { diary: toDiary(data.diary), reward: data.reward, pet: toPet(data.pet) } }
}

// 삭제: 해당 날짜 내 일기
export async function deleteDiary(date) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  const { data, error } = await supabase.from('diaries').delete().eq('date', date).select('id')
  if (error) return { error: toServiceError(error, '일기를 삭제하지 못했어요.') }
  if (data.length === 0) return { error: { code: 'NOT_FOUND', message: '삭제할 일기가 없어요.' } }
  return { data: { deleted: date } }
}

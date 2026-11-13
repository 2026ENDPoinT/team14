import { supabase } from './supabaseClient.js'
import { toPet, toServiceError } from './rewards.js'
import { deleteWithPhotos } from './photos.js'

// 일기 서비스 (docs/API.md 4.6, docs/backend-diary-reward.md)
// - 작성·수정은 save_diary RPC로만 한다. 일기 저장과 보상 판정이 한 트랜잭션이라 저장이 실패하면 보상도 없다.
// - 삭제는 본인 일기만 (RLS). 받은 보상 이력은 지우지 않는다.
// - 사진은 photos 테이블·Storage에 따로 저장한다 (services/photos.js). diaries.photo_urls는 쓰지 않는다.

// DB diaries 행 → 화면용
function toDiary(row) {
  return {
    id: row.id,
    date: row.date,
    mood: row.mood,
    content: row.content,
    photoUrls: row.photo_urls ?? [],
    linkedNodeId: row.linked_node_id,
    footprint: row.footprint ?? '', // 오늘의 발자취 (공부·활동 기록, 선택)
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function requireSession() {
  if (!supabase) return { code: 'SERVER_ERROR', message: 'Supabase 연결 설정(.env)이 없습니다.' }
  const { data } = await supabase.auth.getSession()
  return data.session ? null : { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' }
}

// 발자취(footprint) 칸이 아직 서버에 없는지 (migration 20261114002600 적용 전)
// - 42703: 없는 칸을 조회 / PGRST202·42883: p_footprint 인자가 있는 save_diary가 없음
let footprintReady = true
const isMissingFootprint = (error) => ['42703', 'PGRST202', '42883'].includes(error?.code)
const DIARY_COLUMNS = 'id, date, mood, content, photo_urls, linked_node_id, created_at, updated_at'

// 발자취 칸이 준비됐는지 (화면 안내용)
export function isFootprintReady() {
  return footprintReady
}

// 내 일기 전체 (날짜 오름차순)
export async function listMyDiaries() {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  const query = (columns) => supabase.from('diaries').select(columns).order('date', { ascending: true })
  let { data, error } = await query(footprintReady ? `${DIARY_COLUMNS}, footprint` : DIARY_COLUMNS)
  if (error && isMissingFootprint(error)) {
    // 서버에 발자취 칸이 아직 없으면 발자취 없이 불러온다 (기존 일기는 그대로 보인다)
    footprintReady = false
    ;({ data, error } = await query(DIARY_COLUMNS))
  }
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

// 작성/수정: { date, content, footprint?, linkedNodeId? } → { data: { diary, reward: { rewarded, energy?, reason? }, pet } } 또는 { error }
// footprint: 오늘의 발자취 (보내지 않으면 서버가 기존 값을 유지), linkedNodeId: 발자취에 연결한 내 노드
export async function saveDiary({ date, content, mood = null, linkedNodeId = null, footprint = null }) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  const params = { p_date: date, p_content: content, p_mood: mood, p_linked_node_id: linkedNodeId }
  let { data, error } = await supabase.rpc('save_diary', footprintReady ? { ...params, p_footprint: footprint } : params)
  if (error && isMissingFootprint(error)) {
    // 서버에 발자취 저장이 아직 없으면 발자취 없이 저장한다 (일기 글·연결 활동은 저장됨)
    footprintReady = false
    ;({ data, error } = await supabase.rpc('save_diary', params))
  }
  if (error) return { error: toServiceError(error, '일기를 저장하지 못했어요. 다시 시도해 주세요.') }
  // footprintReward: 오늘의 발자취 보상(+100, migration 20261114002900). 서버가 아직 주지 않으면 null
  return { data: { diary: toDiary(data.diary), reward: data.reward, footprintReward: data.footprint_reward ?? null, pet: toPet(data.pet) } }
}

// 삭제: 해당 날짜 내 일기
export async function deleteDiary(date) {
  const sessionError = await requireSession()
  if (sessionError) return { error: sessionError }
  // 첨부 사진: 연결 행은 DB에서 함께 지워지고, 파일은 삭제가 성공한 뒤 지운다 (services/photos.js)
  const { data: row } = await supabase.from('diaries').select('id').eq('date', date).maybeSingle()
  return deleteWithPhotos({ diaryId: row?.id }, async () => {
    const { data, error } = await supabase.from('diaries').delete().eq('date', date).select('id')
    if (error) return { error: toServiceError(error, '일기를 삭제하지 못했어요.') }
    if (data.length === 0) return { error: { code: 'NOT_FOUND', message: '삭제할 일기가 없어요.' } }
    return { data: { deleted: date } }
  })
}

import { supabase } from './supabaseClient.js'

// 펫·온기 서비스 (docs/backend-pet-home.md)
// - 온기 지급·잔액 변경은 서버 RPC(check_in, save_diary)만 한다. 여기서는 펫을 읽고 화면용으로 바꿀 뿐이다.
// - pet.energy: 누적 획득 온기 (펫 성장 단계용, 줄지 않음) / pet.warmth: 사용할 수 있는 온기 잔액

const SERVER_CODES = ['UNAUTHENTICATED', 'VALIDATION_ERROR', 'NOT_FOUND', 'CONFLICT', 'FORBIDDEN']

export function toServiceError(error, fallback = '잠시 후 다시 시도해 주세요.') {
  if (SERVER_CODES.includes(error?.message)) return { code: error.message, message: error.details || fallback }
  return { code: 'SERVER_ERROR', message: fallback }
}

// DB pets 행 → 화면용 (없으면 null)
export function toPet(row) {
  if (!row) return null
  return {
    id: row.id,
    type: row.type,
    stage: row.stage,
    energy: row.energy,
    warmth: row.warmth_balance,
    name: row.name ?? null, // 이름 칸은 아직 없음 (docs/backend-pet-home.md)
    updatedAt: row.updated_at,
  }
}

async function hasSession() {
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}

// 내 펫 (온보딩 전에 출석만 한 경우에도 펫 행이 있을 수 있다)
export async function getMyPet() {
  if (!(await hasSession())) return { error: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' } }
  const { data, error } = await supabase
    .from('pets')
    .select('id, type, stage, energy, warmth_balance, updated_at')
    .maybeSingle()
  if (error) return { error: toServiceError(error, '펫 정보를 불러오지 못했어요.') }
  return { data: toPet(data) }
}

// 출석(check_in)은 services/api.js checkInToday → features/home/homeActions.js autoCheckIn 한 곳에서 부른다.

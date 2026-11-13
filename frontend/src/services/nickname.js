import { supabase } from './supabaseClient.js'
import { toPet } from './rewards.js'

// 닉네임 변경 (RPC change_nickname, docs/backend-pet-home.md 9장, migration 20261114002500)
// profiles.nickname은 직접 UPDATE할 수 없다 (컬럼 권한 회수). 이 RPC로만 바꾼다.
// 서버가 한 트랜잭션으로: 닉네임 검사(1~8자) → 같은 이름이면 그대로(차감 없음)
//   → 첫 실제 변경은 무료, 이후 변경마다 온기 300 차감(잔액 부족이면 아무것도 바꾸지 않음) → 저장
// 화면에서 온기를 빼거나 닉네임을 직접 profiles에 쓰지 않는다.
// 성공: { data: { nickname, cost, changed, pet } }
//   pet: 차감 후 펫(누적 온기 energy는 그대로, 잔액 warmth만 줄어듦)
// 실패: { error: { code, message } }
//   NOT_READY(RPC 없음) · INSUFFICIENT_WARMTH · VALIDATION_ERROR · UNAUTHENTICATED · SERVER_ERROR
const MESSAGES = {
  INSUFFICIENT_WARMTH: '온기가 부족해요. 닉네임 변경에는 온기 300이 필요해요.',
  VALIDATION_ERROR: '닉네임은 1~8자로 입력해 주세요.',
  UNAUTHENTICATED: '로그인이 필요합니다.',
  NOT_FOUND: '프로필을 찾을 수 없어요. 다시 로그인해 주세요.',
}

export async function changeNickname(nickname) {
  if (!supabase) return { error: { code: 'SERVER_ERROR', message: 'Supabase 연결 설정(.env)이 없습니다.' } }
  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return { error: { code: 'UNAUTHENTICATED', message: MESSAGES.UNAUTHENTICATED } }

  const { data, error } = await supabase.rpc('change_nickname', { p_nickname: nickname })
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      return { error: { code: 'NOT_READY', message: '닉네임 변경은 서버 준비 중이에요.' } }
    }
    const code = MESSAGES[error.message] ? error.message : 'SERVER_ERROR'
    return { error: { code, message: error.details || MESSAGES[code] || '잠시 후 다시 시도해 주세요.' } }
  }
  // 응답 모양이 다르면 저장된 것으로 보지 않는다
  const saved = data?.profile?.nickname
  if (typeof saved !== 'string' || !Number.isFinite(data?.cost)) {
    return { error: { code: 'SERVER_ERROR', message: '닉네임 변경 결과를 확인하지 못했어요.' } }
  }
  return { data: { nickname: saved, cost: data.cost, changed: data.changed !== false, pet: data.pet ? toPet(data.pet) : null } }
}

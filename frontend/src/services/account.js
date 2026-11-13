import { supabase } from './supabaseClient.js'

// 회원탈퇴: Edge Function delete-account가 로그인 세션으로 본인 계정만 삭제한다.
// (관리자 키는 서버 함수 안에서만 쓰고, 프론트에는 없다)
// 결과: { data: { deleted: true } } 또는 { error: { code, message } }
// 모두 삭제된 경우에만 성공이다. 성공 뒤 finishWithdrawal()로 이 기기의 로그인 정보를 지운다.
export async function deleteMyAccount() {
  if (!supabase) return { error: { code: 'SERVER_ERROR', message: 'Supabase 연결 설정(.env)이 없습니다.' } }
  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return { error: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다.' } }

  const { data, error } = await supabase.functions.invoke('delete-account', { body: {} })
  if (error) {
    let message = '탈퇴를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'
    let code = 'SERVER_ERROR'
    try {
      const body = await error.context.json()
      code = body?.error?.code ?? code
      message = body?.error?.message ?? message
    } catch {
      // 네트워크 오류 등
    }
    return { error: { code, message } }
  }
  if (!data?.deleted) return { error: { code: 'SERVER_ERROR', message: '탈퇴를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.' } }

  return { data: { deleted: true } }
}

// 탈퇴 완료 후: 서버 계정은 이미 없으므로 이 기기의 세션만 정리한다
export async function finishWithdrawal() {
  if (supabase) await supabase.auth.signOut({ scope: 'local' })
}

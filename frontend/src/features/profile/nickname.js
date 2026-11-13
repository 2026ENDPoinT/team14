import { changeNickname } from '../../services/nickname.js'
import { setPetFromServer } from '../pet/petStore.js'

// 닉네임 변경 규칙 (HOME·마이페이지 공용)
// - 1~8자 (공백 포함, 이모지 1글자). 유니코드 NFC로 맞추고 앞뒤 공백은 뺀다 (서버 change_nickname과 같은 규칙)
// - 같은 닉네임이면 서버에 보내지 않는다 (차감 없음)
// - 저장·차감은 서버 RPC(change_nickname)만. 성공 응답을 받은 뒤에만 화면(프로필·온기)을 바꾼다
export const NICKNAME_MAX = 8
export const NICKNAME_COST = 300 // 첫 실제 변경은 무료, 이후 변경마다
// 서버 RPC(change_nickname, migration 20261114002500)가 배포됐는지 (HOME 튜토리얼 문구에 쓰임)
export const NICKNAME_SERVER_READY = true

// 서버와 같은 정규화: NFC + 앞뒤 공백 제거
export const normalizeNickname = (name) => String(name ?? '').normalize('NFC').trim()
export const nicknameLength = (name) => [...normalizeNickname(name)].length

export function checkNickname(name) {
  const length = nicknameLength(name)
  if (length === 0) return '닉네임을 입력해 주세요.'
  if (length > NICKNAME_MAX) return `닉네임은 ${NICKNAME_MAX}자까지 쓸 수 있어요.`
  if (/\p{Cc}/u.test(normalizeNickname(name))) return '닉네임에 줄바꿈 같은 특수 문자는 쓸 수 없어요.'
  return null
}

// 결과: { ok: true, message } / { same: true } / { error: 문구, code }
export async function saveNickname(next, { current, applyProfile }) {
  const name = normalizeNickname(next)
  const problem = checkNickname(name)
  if (problem) return { error: problem, code: 'VALIDATION_ERROR' }
  if (name === normalizeNickname(current)) return { same: true }

  const result = await changeNickname(name)
  if (result.error) return { error: result.error.message, code: result.error.code }
  applyProfile({ nickname: result.data.nickname })
  if (result.data.pet) setPetFromServer(result.data.pet) // 차감 후 잔액 (서버 값)
  const cost = result.data.cost
  return { ok: true, message: cost > 0 ? `닉네임을 바꿨어요. 온기 ${cost.toLocaleString()}을 사용했어요.` : '닉네임을 바꿨어요. 첫 변경이라 무료예요.' }
}

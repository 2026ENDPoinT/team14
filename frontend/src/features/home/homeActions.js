// HOME 서버 요청 (자동 출석·펫 이름 변경)
// 온기 증가·차감은 서버 RPC만 한다. 화면에서 성공한 것처럼 처리하지 않는다. (가짜 지급·저장·차감 금지)
import { checkInToday } from '../../services/api.js'
import { getTodayKST } from '../diary/dateUtils.js'

export const ATTENDANCE_REWARD = 100 // 하루 첫 출석 +100 온기
export const RENAME_COST = 300 // 첫 변경 무료, 이후 변경마다 300 온기
export const PET_NAME_MAX = 8 // 펫 이름 최대 글자 수 (공백 포함, 이모지 1글자)

const notReady = (what) => ({
  error: { code: 'NOT_READY', message: `${what} 기능은 서버 준비 중이에요.` },
})

// 자동 출석: HOME에 들어올 때마다 부르되, 같은 사용자·같은 한국 날짜에는 요청을 한 번만 보낸다.
// (StrictMode 두 번 실행·HOME 재진입 때 요청이 여러 번 가지 않게. 지급 여부는 항상 서버 결과로만 판단)
// 반환: { promise, celebrated } — celebrated는 지급 연출을 이미 보여 줬는지 (같은 결과로 두 번 보여 주지 않게)
const attempts = new Map()
export function autoCheckIn(userId) {
  const key = `${userId}:${getTodayKST()}`
  let entry = attempts.get(key)
  if (!entry) {
    entry = { promise: checkInToday(), celebrated: false }
    attempts.set(key, entry)
    // 일시적인 오류(네트워크 등)면 다음 HOME 방문 때 다시 시도. 서버 미준비(NOT_READY)는 이번 접속 동안 다시 묻지 않는다
    entry.promise.then((result) => {
      if (result.error && result.error.code !== 'NOT_READY') attempts.delete(key)
    })
  }
  return entry
}

// 펫 이름 변경: 서버 RPC (이름 저장 + 온기 차감을 한 트랜잭션으로)
// 성공 결과: { pet: { name, ... }, cost: 0 | 300 } / 온기 부족: { error: { code: 'INSUFFICIENT_WARMTH' } }
export async function renamePet(name) {
  void name
  return notReady('펫 이름 변경')
}

// 이름 검사 (화면용. 서버도 다시 검사해야 한다)
export function checkPetName(name) {
  const trimmed = (name ?? '').trim()
  const length = [...trimmed].length
  if (length === 0) return '이름을 입력해 주세요.'
  if (length > PET_NAME_MAX) return `이름은 ${PET_NAME_MAX}자까지 쓸 수 있어요.`
  return null
}

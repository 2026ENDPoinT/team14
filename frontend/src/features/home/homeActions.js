// HOME 서버 요청 자리 (출석·펫 이름 변경)
// 아직 서버 RPC가 없다 → 항상 NOT_READY를 돌려준다. 화면에서 성공한 것처럼 처리하지 않는다.
// (가짜 지급·가짜 저장·가짜 차감 금지. 온기 증가·차감은 서버 RPC만 한다)
// 서버가 준비되면 frontend/src/services/ 의 함수(3번 담당)로 바꾼다. 결과 모양은 아래 주석과 같게.

export const ATTENDANCE_REWARD = 100 // 하루 첫 출석 +100P
export const RENAME_COST = 300 // 첫 변경 무료, 이후 변경마다 300P
export const PET_NAME_MAX = 8 // 펫 이름 최대 글자 수 (공백 포함, 이모지 1글자)

const notReady = (what) => ({
  error: { code: 'NOT_READY', message: `${what} 기능은 서버 준비 중이에요.` },
})

// 출석: 서버 RPC check_in (서버 KST 날짜 기준 하루 1회 +100P)
// 성공 결과: { reward: { rewarded: true, energy: 100 }, pet } / 이미 출석: { reward: { rewarded: false }, pet }
export async function checkIn() {
  return notReady('출석')
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

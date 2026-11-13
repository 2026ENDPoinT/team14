// HOME 서버 요청 (자동 출석)
// 온기 증가·차감은 서버 RPC만 한다. 화면에서 성공한 것처럼 처리하지 않는다. (가짜 지급·저장·차감 금지)
import { checkInToday } from '../../services/api.js'
import { setPetFromServer } from '../pet/petStore.js'
import { toPet } from '../../services/rewards.js'
import { getTodayKST } from '../diary/dateUtils.js'
import { queueReward } from './rewardQueue.js'

export const ATTENDANCE_REWARD = 100 // 하루 첫 출석 +100 온기

// 자동 출석: HOME에 들어올 때마다 부르되, 같은 사용자·같은 한국 날짜에는 요청을 한 번만 보낸다.
// (StrictMode 두 번 실행·HOME 재진입 때 요청이 여러 번 가지 않게. 지급 여부는 항상 서버 결과로만 판단)
// 반환: { promise }. 서버가 지급을 확인하면(rewarded=true) 보상 연출 대기열(rewardQueue)에 넣는다.
//   → AuthProvider(로그인·날짜 변경)가 부른 출석이어도 HOME이 대기열을 보고 "+100 온기"를 보여 준다.
const attempts = new Map()
export function autoCheckIn(userId) {
  const key = `${userId}:${getTodayKST()}`
  let entry = attempts.get(key)
  if (!entry) {
    entry = { promise: checkInToday() }
    attempts.set(key, entry)
    // 일시적인 오류(네트워크 등)면 다음 HOME 방문 때 다시 시도. 서버 미준비(NOT_READY)는 이번 접속 동안 다시 묻지 않는다
    entry.promise.then((result) => {
      if (result.error && result.error.code !== 'NOT_READY') attempts.delete(key)
      // 서버가 돌려준 펫(누적 온기·잔액)으로 홈·일기·마이페이지 표시를 맞춘다
      if (result.data?.petRow) setPetFromServer(toPet(result.data.petRow))
      // 이번 요청에서 새로 지급된 경우에만 연출 (이미 출석한 날은 rewarded=false)
      if (result.data?.rewarded) queueReward({ id: `attendance:${result.data.date ?? getTodayKST()}`, amount: result.data.energy })
    })
  }
  return entry
}

// 이름 변경은 펫 이름이 아니라 사용자 닉네임으로 바뀌었다 → features/profile/nickname.js (서버 RPC change_nickname)

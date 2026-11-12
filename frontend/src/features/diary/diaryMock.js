// 일기 Mock 조회·저장 함수 (DB 연결 전 임시)
// 2-9(데이터 연동) 때 frontend/src/services/ 의 함수로 바꾼다.
// - 메모리에만 저장하므로 새로고침하면 샘플 데이터로 돌아간다.
// - 보상(온기) 판정은 서버 save_diary RPC의 역할이다. 여기서는 결과 모양만 흉내 낸다.
//   (화면에서 펫 에너지를 직접 바꾸지 않는다)
import mockDiaries from '../../data/mockDiaries.js'
import { getTodayKST } from './dateUtils.js'
import { meetsRewardLength } from './countChars.js'
import { mockServerAddWarmth } from '../pet/petMock.js'

// 일기 보상(온기) 양. ※ 문서(SPEC·API)는 아직 +20 → 문서 담당이 바꿔야 함
export const DIARY_REWARD = 200
// 일기 온기를 이미 받은 날 (보상 이력 reward_events의 ref_id = 지급한 KST 날짜를 흉내)
// 샘플 일기는 그 날짜에 이미 받은 것으로 친다.
// ※ 규칙(최종): '오늘(KST) 날짜' 일기가 공백 포함 20자 이상이면 +200, 하루 1회.
//   - 20자 미만으로 저장한 뒤 같은 날 수정해서 20자 이상이 되면 그때 1회 지급
//   - 오늘 이미 받았으면 수정·삭제 후 재작성해도 추가 지급 없음
//   - 과거 날짜 일기는 저장만, 미래 날짜는 작성 불가
//   실제 판정은 서버 save_diary RPC가 서버 시각(Asia/Seoul)으로 해야 한다 (아직 RPC 없음).
const rewardedDays = new Set(mockDiaries.map((d) => d.date))

// 오늘 일기 온기를 이미 받았는지 (화면 안내용. 서버에서는 오늘 reward_events 조회)
export function hasDiaryRewardToday() {
  return rewardedDays.has(getTodayKST())
}

// 서버 판정 흉내 (새로 쓸 때와 수정할 때 모두). 결과의 reason으로 지급하지 않은 이유를 알려 준다.
function judgeReward(date, content) {
  const today = getTodayKST()
  if (date !== today) return { rewarded: false, reason: 'NOT_TODAY' }
  if (!meetsRewardLength(content)) return { rewarded: false, reason: 'TOO_SHORT' }
  if (rewardedDays.has(today)) return { rewarded: false, reason: 'ALREADY_REWARDED' }
  rewardedDays.add(today)
  mockServerAddWarmth(DIARY_REWARD) // 서버가 펫 온기를 올리는 것을 흉내
  return { rewarded: true, type: 'diary_first_write', amount: DIARY_REWARD }
}

// 원본 샘플을 건드리지 않도록 복사해서 사용
let diaries = mockDiaries.map((d) => ({ ...d }))
let nextId = diaries.length + 1

function nowKSTString() {
  // 예: 2026-11-10T21:05:00+09:00
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 19) + '+09:00'
}

// 특정 날짜 일기 1개 (없으면 null). 사용자당 날짜별 일기는 1개다.
export function getDiaryByDate(date) {
  const found = diaries.find((d) => d.date === date)
  return found ? { ...found } : null
}

// 기간별 목록 (from~to, 날짜 포함). 날짜 오름차순
export function listDiaries(from, to) {
  return diaries
    .filter((d) => d.date >= from && d.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d }))
}

// 작성/수정: 같은 날짜 일기가 있으면 수정, 없으면 새로 만든다.
// 글자 수와 관계없이 저장한다. (API.md 4.6)
export function saveDiary({ date, content, linkedNodeId = null }) {
  if (!date) {
    return { error: { code: 'VALIDATION_ERROR', message: '날짜를 선택해 주세요.' } }
  }
  // 미래 날짜 일기는 쓸 수 없다 (YYYY-MM-DD 문자열은 크기 비교로 날짜 비교 가능)
  if (date > getTodayKST()) {
    return { error: { code: 'VALIDATION_ERROR', message: '미래 날짜에는 일기를 쓸 수 없어요.' } }
  }

  const now = nowKSTString()
  const existing = diaries.find((d) => d.date === date)

  if (existing) {
    existing.content = content
    existing.linkedNodeId = linkedNodeId
    existing.updatedAt = now
    // 수정도 같은 판정: 오늘 날짜이고 처음 20자 이상이 되면 1회 지급 (이미 받았으면 없음)
    return { diary: { ...existing }, reward: judgeReward(date, content) }
  }

  const diary = {
    id: `d_${nextId++}`,
    date,
    mood: null, // [미확정] 기분 목록 확정 전까지 null
    content,
    photoUrls: [],
    linkedNodeId,
    createdAt: now,
    updatedAt: now,
  }
  diaries.push(diary)
  return { diary: { ...diary }, reward: judgeReward(date, content) }
}

// 삭제: 해당 날짜 일기를 지운다. (API.md 4.6)
// 이미 받은 보상 이력은 서버에 그대로 남는다. 다시 써도 같은 날 보상은 다시 받지 않는다.
export function deleteDiary(date) {
  const index = diaries.findIndex((d) => d.date === date)
  if (index === -1) {
    return { error: { code: 'NOT_FOUND', message: '삭제할 일기가 없어요.' } }
  }
  diaries.splice(index, 1)
  return { deleted: date }
}

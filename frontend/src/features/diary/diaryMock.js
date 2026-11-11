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
// 이미 온기를 받은 일기 날짜 (샘플 일기는 이미 받은 것으로 친다)
// ※ 새 규칙(팀 확정): 날짜마다 '처음 작성'한 일기에만 지급, 수정은 지급 없음.
//   API.md 3장(서버 오늘 기준 하루 1회, 소급 없음)과 다르므로 3번과 문서 수정이 필요하다.
const rewardedDates = new Set(mockDiaries.map((d) => d.date))

// 서버 판정 흉내: 그 날짜의 일기를 처음 만들 때 기준 글자 수를 채웠으면 지급
// 삭제 후 다시 써도 같은 날짜는 다시 받지 않는다.
function judgeReward(date, content) {
  if (!meetsRewardLength(content) || rewardedDates.has(date)) return { rewarded: false }
  rewardedDates.add(date)
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
    return { diary: { ...existing }, reward: { rewarded: false } } // 수정은 온기 없음
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

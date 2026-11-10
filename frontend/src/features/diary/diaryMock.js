// 일기 Mock 조회·저장 함수 (DB 연결 전 임시)
// 2-9(데이터 연동) 때 frontend/src/services/ 의 함수로 바꾼다.
// - 메모리에만 저장하므로 새로고침하면 샘플 데이터로 돌아간다.
// - 보상·펫 에너지는 다루지 않는다. (서버 save_diary RPC의 역할)
import mockDiaries from '../../data/mockDiaries.js'
import { getTodayKST } from './dateUtils.js'

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
    return { diary: { ...existing } }
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
  return { diary: { ...diary } }
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

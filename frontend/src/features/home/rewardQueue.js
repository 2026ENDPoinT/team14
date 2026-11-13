// 보상 연출 대기열 (HOME의 "+N 온기")
// - 서버가 지급을 확인한 보상만 넣는다 (출석 check_in, 일기 save_diary 등). 화면에서 온기를 더하지 않는다.
// - 다른 화면에 있을 때 받은 보상도 HOME에 오면 한 번 보여 준다. 같은 보상(id)은 한 접속에서 한 번만.
// - 연출이 0.9초 이상 보였으면 '본 것'으로 친다. 그 전에 HOME이 사라지면(로딩 화면으로 다시 그려짐 등)
//   다음에 HOME을 열 때 다시 보여 주고, 본 뒤에 떠났으면 다시 보여 주지 않는다.
// - 새로고침하면 비워진다 (서버가 이미 받은 보상은 rewarded=false로 알려 주므로 다시 쌓이지 않는다).
import { useSyncExternalStore } from 'react'

let queue = [] // [{ id, amount }]
const shown = new Set() // 연출을 (충분히) 보여 준 보상 id
const listeners = new Set()
const emit = () => listeners.forEach((listener) => listener())
const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// 보상 넣기. id 예: 'attendance:2026-11-13', 'diary:2026-11-13'
export function queueReward({ id, amount }) {
  if (!Number.isFinite(amount) || amount <= 0) return
  if (shown.has(id) || queue.some((r) => r.id === id)) return
  queue = [...queue, { id, amount }]
  emit()
}

// 연출이 충분히 보였을 때 (아직 재생 중일 수 있음)
export function markRewardSeen(id) {
  shown.add(id)
}

// 지금까지 본 보상 id (HOME을 열 때 한 번 읽어서, 첫 화면부터 다시 보여 주지 않게)
export function seenRewardIds() {
  return new Set(shown)
}

// HOME을 새로 열 때: 이미 본 보상(도중에 떠난 것)은 대기열에서 뺀다
export function dropSeenRewards() {
  const next = queue.filter((r) => !shown.has(r.id))
  if (next.length !== queue.length) {
    queue = next
    emit()
  }
}

// 연출이 끝났을 때 (맨 앞 보상)
export function finishReward(id) {
  shown.add(id)
  queue = queue.filter((r) => r.id !== id)
  emit()
}

export function useRewardQueue() {
  return useSyncExternalStore(subscribe, () => queue)
}

// 테스트·로그아웃용
export function clearRewards() {
  queue = []
  shown.clear()
  emit()
}

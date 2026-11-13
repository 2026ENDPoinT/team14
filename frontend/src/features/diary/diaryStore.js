// 일기 데이터 저장소 (서버 연결). diaryMock.js와 같은 이름의 함수를 그대로 제공한다.
// - 읽기(getDiaryByDate, listDiaries, hasDiaryRewardToday)는 불러 둔 목록에서 바로 읽는다.
//   화면은 useDiaries()를 불러 두면 목록이 바뀔 때 다시 그려진다.
// - 쓰기(saveDiary, deleteDiary)는 서버에 저장한 뒤 성공했을 때만 목록을 바꾼다. (async)
// - 다른 사용자로 로그인하면 목록을 새로 불러온다.
import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../../services/supabaseClient.js'
import * as diaryService from '../../services/diary.js'
import { getTodayKST } from './dateUtils.js'
import { setPetFromServer } from '../pet/petStore.js'

export const DIARY_REWARD = 200

let state = { status: 'idle', userId: null, diaries: [], rewardedToday: false, error: null }
const listeners = new Set()
function setState(patch) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}
const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

let loading = null
async function currentUserId() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

// 지금 로그인한 사용자의 일기를 불러온다 (이미 불러왔으면 다시 부르지 않는다. force면 다시)
export async function loadDiaries(force = false) {
  const userId = await currentUserId()
  if (!userId) {
    setState({ status: 'idle', userId: null, diaries: [], rewardedToday: false, error: null })
    return
  }
  if (!force && state.userId === userId && (state.status === 'ready' || loading)) return loading
  if (state.userId !== userId) setState({ userId, diaries: [], rewardedToday: false })
  setState({ status: 'loading', error: null })
  loading = (async () => {
    const [list, reward] = await Promise.all([diaryService.listMyDiaries(), diaryService.hasDiaryRewardOn(getTodayKST())])
    loading = null
    if (list.error) {
      setState({ status: 'error', error: list.error })
      return
    }
    setState({ status: 'ready', diaries: list.data, rewardedToday: Boolean(reward.data), error: null })
  })()
  return loading
}

if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (session?.user.id && state.userId && session.user.id !== state.userId)) {
      setState({ status: 'idle', userId: null, diaries: [], rewardedToday: false, error: null })
    }
  })
}

// 화면용 훅: 처음 그릴 때 불러오고, 바뀌면 다시 그린다. { status, error, reload }
export function useDiaries() {
  const snapshot = useSyncExternalStore(subscribe, () => state)
  useEffect(() => {
    loadDiaries()
  }, [])
  return { status: snapshot.status, error: snapshot.error, reload: () => loadDiaries(true) }
}

// 특정 날짜 일기 1개 (없으면 null)
export function getDiaryByDate(date) {
  const found = state.diaries.find((d) => d.date === date)
  return found ? { ...found } : null
}

// 기간별 목록 (from~to, 날짜 포함). 날짜 오름차순
export function listDiaries(from, to) {
  return state.diaries.filter((d) => d.date >= from && d.date <= to).map((d) => ({ ...d }))
}

// 오늘 일기 온기를 이미 받았는지 (안내 문구용)
export function hasDiaryRewardToday() {
  return state.rewardedToday
}

// 작성/수정 → 서버 저장 성공 시에만 목록 반영
// 결과: { diary, reward: { rewarded, amount?, reason? }, footprintReward: { rewarded, amount?, reason? } | null } 또는 { error }
//   (실패하면 화면의 입력 내용은 그대로 둔다). 발자취 보상(+100)은 일기 보상(+200)과 따로 판정된다
// footprint(오늘의 발자취)·linkedNodeId(연결한 노드)는 선택
export async function saveDiary({ date, content, footprint = null, linkedNodeId = null }) {
  if (!date) return { error: { code: 'VALIDATION_ERROR', message: '날짜를 선택해 주세요.' } }
  if (date > getTodayKST()) return { error: { code: 'VALIDATION_ERROR', message: '미래 날짜에는 일기를 쓸 수 없어요.' } }
  const result = await diaryService.saveDiary({ date, content, footprint, linkedNodeId })
  if (result.error) return { error: result.error }
  const { diary, reward, footprintReward, pet } = result.data
  const others = state.diaries.filter((d) => d.date !== diary.date)
  setState({
    diaries: [...others, diary].sort((a, b) => a.date.localeCompare(b.date)),
    rewardedToday: state.rewardedToday || (reward.rewarded && diary.date === getTodayKST()),
  })
  if (pet) setPetFromServer(pet) // 홈·일기 화면의 온기 표시를 서버 값으로 맞춘다
  return {
    diary,
    reward: { rewarded: reward.rewarded, amount: reward.energy, reason: reward.reason },
    footprintReward: footprintReward && { rewarded: footprintReward.rewarded, amount: footprintReward.energy, reason: footprintReward.reason },
  }
}

// 삭제 → 서버 삭제 성공 시에만 목록 반영
export async function deleteDiary(date) {
  const result = await diaryService.deleteDiary(date)
  if (result.error) return { error: result.error }
  setState({ diaries: state.diaries.filter((d) => d.date !== date) })
  return { deleted: date }
}

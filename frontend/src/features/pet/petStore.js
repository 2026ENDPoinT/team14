// 펫 데이터 저장소 (서버 연결). 홈·일기·마이페이지가 같은 값을 본다.
// - 온기 잔액(warmth)·누적 온기(energy)는 서버 값만 쓴다. 화면에서 더하거나 빼지 않는다.
// - 출석·일기 저장 RPC가 돌려준 펫으로 바로 갱신하고, 화면을 열 때 한 번 다시 읽는다.
import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../../services/supabaseClient.js'
import { getMyPet } from '../../services/rewards.js'

// 펫 행이 아직 없을 때(온보딩 직후 등) 쓰는 빈 값
export const EMPTY_PET = { id: null, type: null, stage: 1, energy: 0, warmth: 0, name: null }

let state = { status: 'idle', pet: null, error: null }
// 서버 RPC 결과로 펫을 맞춘 횟수. 다시 읽기(reloadPet)가 그보다 먼저 시작됐으면 그 결과(옛 값)는 버린다
// (HOME을 열 때 읽기와 출석이 동시에 가면, 늦게 도착한 읽기가 출석 후 잔액을 옛 값으로 덮지 않게)
let serverVersion = 0
const listeners = new Set()
function setState(patch) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}
const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function reloadPet() {
  setState({ status: state.pet ? 'ready' : 'loading', error: null })
  const startedAt = serverVersion
  const result = await getMyPet()
  if (startedAt !== serverVersion) return // 읽는 동안 RPC 결과가 더 새 값으로 맞췄다
  if (result.error) {
    setState({ status: 'error', error: result.error })
    return
  }
  setState({ status: 'ready', pet: result.data ?? EMPTY_PET })
}

// 서버 RPC가 돌려준 펫으로 바로 맞춘다 (check_in, save_diary 결과)
export function setPetFromServer(pet) {
  if (!pet) return
  serverVersion += 1
  setState({ status: 'ready', pet, error: null })
}

if (supabase) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') setState({ status: 'idle', pet: null, error: null })
  })
}

// 화면용 훅: { status, pet, error, reload }. pet은 불러오기 전에는 null
export function usePet() {
  const snapshot = useSyncExternalStore(subscribe, () => state)
  useEffect(() => {
    reloadPet()
  }, [])
  return { status: snapshot.status, pet: snapshot.pet, error: snapshot.error, reload: reloadPet }
}

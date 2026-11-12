import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getMyProfile, isSupabaseConfigured, signOut, subscribeAuthChange } from '../../services/api.js'

// 로그인·온보딩 상태를 앱 전체에서 한 곳에서 관리한다.
//
// status
//   'loading'      : 로그인·프로필 확인 중 (이 동안 어떤 내부 화면도 그리지 않는다)
//   'signedOut'    : 로그인 안 됨
//   'ready'        : 로그인 + 프로필 조회 성공 (profile.onboardingCompleted로 온보딩 여부 판단)
//   'error'        : 로그인은 됐지만 프로필 조회 실패 → 온보딩 미완료로 간주하지 않고 오류·재시도
//   'unconfigured' : frontend/.env에 Supabase 연결 설정이 없음
//
// Google 로그인·이메일 인증·비밀번호 재설정 링크로 돌아왔을 때:
//   getMyProfile 안의 getSession()은 Supabase가 주소의 인증 정보를 처리할 때까지 기다린다.
//   그래서 처리 전에 status가 'signedOut'이 되어 /login으로 튕기는 일이 없다.

const AuthContext = createContext(null)

// 비밀번호 재설정 링크로 열렸는지 (Supabase가 주소를 정리하기 전에 읽어 둔다)
const OPENED_FROM_RECOVERY_LINK = /(^|[#&?])type=recovery(&|$)/.test(window.location.hash + window.location.search)

export function AuthProvider({ children }) {
  const [state, setState] = useState(isSupabaseConfigured ? { status: 'loading' } : { status: 'unconfigured' })
  const [recovery, setRecovery] = useState(OPENED_FROM_RECOVERY_LINK)
  // 방금 온보딩 저장에 성공해 완료 화면을 보고 있는 중 (이때만 /onboarding에 머문다)
  const [justCompleted, setJustCompleted] = useState(false)
  const userIdRef = useRef(undefined) // 지금 프로필을 불러온(또는 불러오는 중인) 사용자
  const loadSeqRef = useRef(0) // 확인 요청 번호. 여러 번 겹치면 가장 마지막 요청의 결과만 쓴다

  // 로그인 상태와 프로필을 다시 확인한다. 결과 상태를 돌려준다.
  const reload = useCallback(async () => {
    const seq = ++loadSeqRef.current
    setState({ status: 'loading' })
    const result = await getMyProfile()
    if (seq !== loadSeqRef.current) return null // 더 늦게 시작한 확인이 있으면 그 결과를 따른다
    let next
    if (result.error) next = { status: 'error', error: result.error }
    else if (!result.data) next = { status: 'signedOut' }
    else next = { status: 'ready', profile: result.data }
    userIdRef.current = next.profile?.id ?? (next.status === 'signedOut' ? null : userIdRef.current)
    setState(next)
    return next
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    let alive = true
    reload()
    const unsubscribe = subscribeAuthChange((event, userId) => {
      if (!alive) return
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') {
        userIdRef.current = null
        setRecovery(false)
        setJustCompleted(false)
        setState({ status: 'signedOut' })
        return
      }
      // 다른 사용자로 로그인했을 때만 프로필을 다시 읽는다 (토큰 갱신·첫 세션 알림은 무시)
      // Supabase 안내대로 이 콜백 안에서 바로 Supabase를 호출하지 않고 한 박자 뒤에 부른다.
      if (event !== 'INITIAL_SESSION' && userId && userId !== userIdRef.current) {
        userIdRef.current = userId
        setTimeout(() => { if (alive) reload() }, 0)
      }
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [reload])

  // 온보딩 저장 성공: 프로필의 완료 상태를 바로 반영하고, 완료 화면에 머물게 한다
  const markOnboardingCompleted = useCallback(() => {
    setState((prev) => (prev.status === 'ready' ? { ...prev, profile: { ...prev.profile, onboardingCompleted: true } } : prev))
    setJustCompleted(true)
  }, [])

  // 서버에 저장한 프로필 변경(예: 희망 직무)을 바로 반영한다. 로딩 화면 없이 다른 화면(HOME 등)도 새 값을 쓴다.
  const applyProfile = useCallback((profile) => {
    setState((prev) => (prev.status === 'ready' ? { ...prev, profile: { ...prev.profile, ...profile } } : prev))
  }, [])

  // 완료 화면의 [시작하기]: 이후 /onboarding으로 오면 HOME으로 보낸다
  const finishOnboarding = useCallback(() => setJustCompleted(false), [])

  const logout = useCallback(async () => {
    const result = await signOut()
    if (!result.error) {
      userIdRef.current = null
      setJustCompleted(false)
      setState({ status: 'signedOut' })
    }
    return result
  }, [])

  const value = useMemo(
    () => ({ ...state, recovery, justCompleted, reload, markOnboardingCompleted, applyProfile, finishOnboarding, logout }),
    [state, recovery, justCompleted, reload, markOnboardingCompleted, applyProfile, finishOnboarding, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있어요.')
  return value
}

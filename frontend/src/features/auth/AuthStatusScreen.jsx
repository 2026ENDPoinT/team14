import { useState } from 'react'
import { useAuth } from './AuthProvider.jsx'
import './auth.css'

// 로그인·온보딩 상태를 확인하는 동안 보여 주는 화면 (내부 화면이 잠깐 보이는 것을 막는다)
export function AuthLoadingScreen() {
  return (
    <main className="auth-status" aria-busy="true">
      <p className="auth-status__text" role="status">로그인 상태를 확인하고 있어요…</p>
    </main>
  )
}

// 연결 설정이 없거나, 로그인은 됐는데 프로필을 읽지 못했을 때
// (온보딩 미완료로 간주하지 않고, 다시 시도하거나 로그아웃할 수 있게 한다)
export function AuthErrorScreen() {
  const { status, error, reload, logout } = useAuth()
  const [busy, setBusy] = useState(false)

  if (status === 'unconfigured') {
    return (
      <main className="auth-status">
        <h1 className="auth-status__title">서버에 연결할 수 없어요</h1>
        <p className="auth-status__text" role="alert">
          Supabase 연결 설정이 없어요. frontend/.env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 넣고 다시 실행해 주세요.
        </p>
      </main>
    )
  }

  const run = async (action) => {
    setBusy(true)
    await action()
    setBusy(false)
  }

  return (
    <main className="auth-status">
      <h1 className="auth-status__title">내 정보를 불러오지 못했어요</h1>
      <p className="auth-status__text" role="alert">{error?.message ?? '잠시 후 다시 시도해 주세요.'}</p>
      <div className="auth-status__actions">
        <button type="button" className="auth-status__primary" disabled={busy} onClick={() => run(reload)}>
          다시 시도
        </button>
        <button type="button" className="auth-status__secondary" disabled={busy} onClick={() => run(logout)}>
          로그아웃
        </button>
      </div>
    </main>
  )
}

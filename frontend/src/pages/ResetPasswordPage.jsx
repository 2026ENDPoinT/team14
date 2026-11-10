import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { endCurrentSession, hasRecoverySession, updatePassword } from '../services/api.js'
import { EyeIcon, LockIcon, SproutIcon } from '../features/auth/AuthIcons.jsx'
import '../features/auth/auth.css'

// 비밀번호 재설정 화면: 메일의 재설정 링크를 누르면 이 화면으로 돌아온다.
// 링크를 열면 Supabase가 임시 로그인 세션을 만들어 주고, 그 상태에서 새 비밀번호를 저장한다.

function readErrorFromUrl() {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return query.get('error_description') || hash.get('error_description')
}

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [canReset, setCanReset] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  // 비밀번호는 바뀌었지만 세션 종료에 실패한 상태
  const [sessionEndFailed, setSessionEndFailed] = useState(false)
  const [error, setError] = useState(readErrorFromUrl())

  useEffect(() => {
    hasRecoverySession().then((result) => {
      setCanReset(Boolean(result.data))
      if (result.error) setError(result.error.message)
      setChecking(false)
    })
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    if (password.length < 6) return setError('비밀번호는 6자 이상으로 입력해 주세요.')
    if (password !== confirm) return setError('두 비밀번호가 서로 달라요.')

    setBusy(true)
    const result = await updatePassword(password)
    if (result.error) {
      setBusy(false)
      return setError(result.error.message) // 변경 실패: 이 화면에서 다시 시도
    }
    await finishAndGoToLogin()
  }

  // 복구 세션을 종료하고 /login으로 이동 (로그인 폼과 완료 안내가 보이게)
  async function finishAndGoToLogin() {
    setBusy(true)
    setError(null)
    const result = await endCurrentSession()
    setBusy(false)
    if (result.error) {
      setSessionEndFailed(true)
      return
    }
    navigate('/login', { replace: true, state: { passwordChanged: true } })
  }

  return (
    <main className="login-page is-single">
      <section className="login-card" aria-label="비밀번호 재설정">
        <h2 className="login-logo">
          <SproutIcon />
          CampusBuddy
        </h2>
        <p className="login-tagline">새 비밀번호 설정</p>

        {checking && <p className="login-notice">확인 중…</p>}

        {!checking && sessionEndFailed && (
          <>
            <p className="login-notice" role="status">
              비밀번호는 변경되었지만, 이 브라우저의 로그인 상태를 정리하지 못했어요. 아래 버튼으로
              다시 시도해 주세요.
            </p>
            <button
              type="button"
              className="login-primary"
              onClick={finishAndGoToLogin}
              disabled={busy}
            >
              {busy ? '처리 중…' : '로그인 상태 정리 다시 시도'}
            </button>
          </>
        )}

        {!checking && !sessionEndFailed && canReset && (
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label className="login-input">
              <LockIcon />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="새 비밀번호 (6자 이상)"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="login-icon-button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
              >
                <EyeIcon off={showPassword} />
              </button>
            </label>
            <label className="login-input">
              <LockIcon />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="새 비밀번호 확인"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </label>
            <button type="submit" className="login-primary" disabled={busy}>
              {busy ? '저장 중…' : '비밀번호 저장'}
            </button>
          </form>
        )}

        {!checking && !sessionEndFailed && !canReset && (
          <>
            <p className="login-help">
              재설정 링크가 만료되었거나 올바르지 않아요. 로그인 화면의 ‘비밀번호 찾기’에서
              링크를 다시 받아 주세요.
            </p>
            <button type="button" className="login-primary" onClick={() => navigate('/login')}>
              로그인 화면으로
            </button>
          </>
        )}

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  )
}

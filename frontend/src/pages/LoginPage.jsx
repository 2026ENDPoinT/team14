import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  getMyProfile,
  isSupabaseConfigured,
  sendPasswordResetEmail,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
} from '../services/api.js'

// 로그인 화면 (기능만, 디자인은 담당자가 적용 예정)
// - 이메일 로그인 / 회원가입 / 비밀번호 찾기 / Google 로그인
// - 로그인되어 있으면 온보딩 완료 여부에 따라 이동: 미완료 → /onboarding, 완료 → /roadmap

// Google 로그인·메일 링크가 실패하면 Supabase가 주소 뒤에 오류를 붙여 보낸다.
function readErrorFromUrl() {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return (
    query.get('error_description') ||
    hash.get('error_description') ||
    query.get('error') ||
    hash.get('error')
  )
}

const MODE_TEXT = {
  login: { button: '로그인', footer: '아직 계정이 없나요?', switchTo: 'signup', switchLabel: '회원가입' },
  signup: { button: '회원가입', footer: '이미 계정이 있나요?', switchTo: 'login', switchLabel: '로그인' },
  reset: { button: '재설정 링크 보내기', footer: '비밀번호가 생각났나요?', switchTo: 'login', switchLabel: '로그인' },
}

const PASSWORD_CHANGED_NOTICE = '비밀번호 수정이 완료되었습니다. 수정된 비밀번호로 로그인하세요.'

// 가입 여부가 드러나지 않도록, 가입·미가입 주소 모두 같은 문구를 보여준다.
const RESET_SENT_NOTICE =
  '가입된 이메일 주소라면 비밀번호 재설정 링크를 보내드려요. 메일이 오지 않으면 입력한 주소와 스팸함을 확인해 주세요.'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // 비밀번호 재설정 화면에서 넘어온 경우: 자동 이동 없이 로그인 폼과 완료 안내를 보여준다.
  const [passwordChanged] = useState(Boolean(location.state?.passwordChanged))
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [checking, setChecking] = useState(!passwordChanged)
  const [loggedIn, setLoggedIn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(passwordChanged ? PASSWORD_CHANGED_NOTICE : null)
  const [error, setError] = useState(readErrorFromUrl())

  // 로그인 상태면 온보딩 완료 여부를 보고 이동한다.
  const goNextIfLoggedIn = useCallback(async () => {
    const result = await getMyProfile()
    if (result.error) {
      // 연결 설정이 없을 때는 로그인 폼을 그대로 두고, 로그인 후 실패면 로그아웃 버튼을 보여준다.
      setLoggedIn(isSupabaseConfigured)
      setError(result.error.message)
      return
    }
    if (!result.data) return // 로그인 안 됨
    navigate(result.data.onboardingCompleted ? '/roadmap' : '/onboarding', { replace: true })
  }, [navigate])

  useEffect(() => {
    if (passwordChanged) {
      // 새로고침 때 안내가 다시 뜨지 않도록 주소의 상태 값만 지운다.
      navigate('/login', { replace: true, state: null })
      return
    }
    goNextIfLoggedIn().finally(() => setChecking(false))
  }, [passwordChanged, goNextIfLoggedIn, navigate])

  function changeMode(nextMode) {
    setMode(nextMode)
    setError(null)
    setNotice(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) return setError('이메일을 입력해 주세요.')
    if (mode !== 'reset' && !password) return setError('비밀번호를 입력해 주세요.')
    if (mode === 'signup' && password.length < 6) {
      return setError('비밀번호는 6자 이상으로 입력해 주세요.')
    }

    setBusy(true)
    if (mode === 'login') {
      const result = await signInWithEmail(trimmedEmail, password)
      if (result.error) setError(result.error.message)
      else await goNextIfLoggedIn()
    }
    if (mode === 'signup') {
      const result = await signUpWithEmail(trimmedEmail, password)
      if (result.error) setError(result.error.message)
      else if (result.data.needsEmailConfirm) {
        setNotice('인증 메일을 확인해 주세요. 메일의 링크를 누르면 로그인됩니다.')
      } else await goNextIfLoggedIn()
    }
    if (mode === 'reset') {
      const result = await sendPasswordResetEmail(trimmedEmail)
      if (result.error) setError(result.error.message)
      else setNotice(RESET_SENT_NOTICE)
    }
    setBusy(false)
  }

  async function handleGoogleLogin() {
    setError(null)
    setNotice(null)
    setBusy(true)
    const result = await signInWithGoogle('/login')
    // 성공하면 Google 화면으로 이동했다가 /login으로 돌아온다.
    if (result.error) {
      setError(result.error.message)
      setBusy(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    setLoggedIn(false)
    setError(null)
  }

  const text = MODE_TEXT[mode]

  return (
    <main>
      <h1>로그인</h1>

      {checking ? (
        <p>로그인 상태 확인 중…</p>
      ) : loggedIn ? (
        <button type="button" onClick={handleSignOut}>
          로그아웃하고 다른 계정으로 로그인
        </button>
      ) : (
        <>
          <form onSubmit={handleSubmit} noValidate>
            {mode === 'reset' && (
              <p>가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드려요.</p>
            )}

            <div>
              <input
                type="email"
                placeholder="이메일"
                aria-label="이메일"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="비밀번호"
                  aria-label="비밀번호"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? '숨기기' : '보기'}
                </button>
              </div>
            )}

            {mode === 'login' && (
              <button type="button" onClick={() => changeMode('reset')}>
                비밀번호 찾기
              </button>
            )}

            <div>
              <button type="submit" disabled={busy}>
                {busy ? '처리 중…' : text.button}
              </button>
            </div>
          </form>

          {mode !== 'reset' && (
            <>
              <p>또는</p>
              <button type="button" onClick={handleGoogleLogin} disabled={busy}>
                Google로 계속하기
              </button>
            </>
          )}

          <p>
            {text.footer}{' '}
            <button type="button" onClick={() => changeMode(text.switchTo)}>
              {text.switchLabel}
            </button>
          </p>
        </>
      )}

      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </main>
  )
}

import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  sendPasswordResetEmail,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../services/api.js'
import { useAuth } from '../features/auth/AuthProvider.jsx'
import '../features/diary/DiaryEditor.css' // 색 변수(.diary-page)
import '../features/login/Login.css'

// 로그인 화면 (기능: 3번 / 디자인: 2번 — 로드맵·일기와 같은 테마)
// - 이메일 로그인 / 회원가입 / 비밀번호 찾기 / Google 로그인
// - 로그인되어 있으면 온보딩 완료 여부에 따라 이동: 미완료 → /onboarding, 완료 → HOME(/)
// - 로그인 상태·프로필은 AuthProvider가 한 곳에서 확인한다 (Google·이메일 인증 링크 처리가 끝난 뒤)

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

const NO_CONFIG_MESSAGE = 'Supabase 연결 설정(.env)이 없습니다.'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuth()
  // 비밀번호 재설정 화면에서 넘어온 경우: 자동 이동 없이 로그인 폼과 완료 안내를 보여준다.
  const [passwordChanged] = useState(Boolean(location.state?.passwordChanged))
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(
    passwordChanged ? PASSWORD_CHANGED_NOTICE : location.state?.withdrawn ? '탈퇴가 완료되었어요. 그동안 이용해 주셔서 고마워요.' : null,
  )
  // 탈퇴 직후 로그인 화면으로 왔을 때 (이미 열려 있던 경우에도) 완료 안내
  const withdrawn = Boolean(location.state?.withdrawn)
  useEffect(() => {
    if (withdrawn) setNotice('탈퇴가 완료되었어요. 그동안 이용해 주셔서 고마워요.')
  }, [withdrawn])
  const [error, setError] = useState(readErrorFromUrl() ?? (auth.status === 'unconfigured' ? NO_CONFIG_MESSAGE : null))

  const checking = auth.status === 'loading'
  // 로그인은 됐는데 프로필을 읽지 못한 상태: 다시 시도·로그아웃을 보여준다 (온보딩으로 보내지 않음)
  const loggedIn = auth.status === 'error'

  useEffect(() => {
    if (passwordChanged) {
      // 새로고침 때 안내가 다시 뜨지 않도록 주소의 상태 값만 지운다.
      navigate('/login', { replace: true, state: null })
    }
  }, [passwordChanged, navigate])

  // 로그인 상태 + 프로필 확인 완료 → 온보딩 여부에 따라 이동
  if (auth.status === 'ready') {
    if (auth.recovery) return <Navigate to="/reset-password" replace />
    return <Navigate to={auth.profile.onboardingCompleted ? '/' : '/onboarding'} replace />
  }

  // 로그인·가입 직후: 프로필을 다시 확인한다. 성공하면 위의 이동이 일어난다.
  async function goNextIfLoggedIn() {
    const next = await auth.reload()
    if (next?.status === 'error') setError(next.error.message)
  }

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
    await auth.logout()
    setError(null)
  }

  const text = MODE_TEXT[mode]
  const title = { login: '로그인', signup: '회원가입', reset: '비밀번호 찾기' }[mode]

  return (
    <div className="diary-page lg-page">
      <main className="lg-main">
        {/* 서비스 이름 ([미확정] Campus Roadmap은 가칭) */}
        <header className="lg-brand">
          <span className="lg-logo" aria-hidden="true"><RoadmapMark /></span>
          <p className="lg-name">Campus <strong>Roadmap</strong></p>
          <p className="lg-tagline">계획하고, 기록하고, 펫과 함께 자라는 대학생활</p>
        </header>

        {/* 로그인 카드 */}
        <section className="lg-card" aria-label={title}>
          <div className="lg-title-row">
            {/* 회원가입 중이면 로그인으로 돌아가는 화살표 */}
            {mode === 'signup' && !checking && !loggedIn && (
              <button
                type="button"
                className="lg-back"
                aria-label="로그인으로 돌아가기"
                onClick={() => changeMode('login')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" />
                </svg>
              </button>
            )}
            <h2 className="lg-title">{title}</h2>
          </div>

          {checking ? (
            <p className="lg-muted">로그인 상태 확인 중…</p>
          ) : loggedIn ? (
            <div className="lg-form">
              <button type="button" className="lg-btn lg-btn--accent" onClick={() => auth.reload()}>
                다시 시도
              </button>
              <button type="button" className="lg-btn" onClick={handleSignOut}>
                로그아웃하고 다른 계정으로 로그인
              </button>
            </div>
          ) : (
            <>
              <form className="lg-form" onSubmit={handleSubmit} noValidate>
                {mode === 'reset' && (
                  <p className="lg-muted">가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드려요.</p>
                )}

                <label className="lg-field">
                  <span className="lg-field__label">이메일</span>
                  <input
                    className="lg-input"
                    type="email"
                    placeholder="example@university.ac.kr"
                    aria-label="이메일"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>

                {mode !== 'reset' && (
                  <label className="lg-field">
                    <span className="lg-field__label">비밀번호</span>
                    <span className="lg-pw">
                      <input
                        className="lg-input"
                        type={showPassword ? 'text' : 'password'}
                        placeholder={mode === 'signup' ? '6자 이상' : '비밀번호'}
                        aria-label="비밀번호"
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                      <button
                        type="button"
                        className="lg-pw__toggle"
                        aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        <EyeIcon off={showPassword} />
                      </button>
                    </span>
                  </label>
                )}

                {mode === 'login' && (
                  <button type="button" className="lg-text-btn lg-forgot" onClick={() => changeMode('reset')}>
                    비밀번호 찾기
                  </button>
                )}

                <button type="submit" className="lg-btn lg-btn--accent" disabled={busy}>
                  {busy ? '처리 중…' : text.button}
                </button>
              </form>

              {mode !== 'reset' && (
                <>
                  <p className="lg-or"><span>또는</span></p>
                  <button type="button" className="lg-btn lg-btn--google" onClick={handleGoogleLogin} disabled={busy}>
                    <GoogleIcon />
                    Google로 계속하기
                  </button>
                </>
              )}

              <p className="lg-footer">
                {text.footer}{' '}
                <button type="button" className="lg-text-btn lg-text-btn--strong" onClick={() => changeMode(text.switchTo)}>
                  {text.switchLabel}
                </button>
              </p>
            </>
          )}

          {notice && <p className="lg-msg" role="status">{notice}</p>}
          {(error || (loggedIn && auth.error)) && (
            <p className="lg-msg lg-msg--error" role="alert">
              {error ?? `내 정보를 불러오지 못했어요. ${auth.error.message}`}
            </p>
          )}
        </section>
      </main>
    </div>
  )
}

// 로고: 위로 이어지는 로드맵 노드 3개 (마지막은 노란 점)
function RoadmapMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <path d="M5 18L12 12L19 6" stroke="#bdbdbd" strokeWidth="2" strokeLinecap="round" />
      <circle cx="5" cy="18" r="2.8" fill="#d0d0d0" />
      <circle cx="12" cy="12" r="2.8" fill="#9a9a9a" />
      <circle cx="19" cy="6" r="3.2" fill="#f2d68f" />
    </svg>
  )
}

// 비밀번호 보기/숨기기 눈 아이콘 (로드맵 아이콘과 같은 선 굵기)
function EyeIcon({ off }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 4l16 16" />}
    </svg>
  )
}

// Google 로고 (로그인 버튼 표준 표기)
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteMyAccount, finishWithdrawal } from '../../services/account.js'
import './withdraw.css'

// 삭제되는 정보 (DB 연쇄 삭제 + 첨부 파일)
const DELETED_ITEMS = [
  '로그인 계정 (이메일·Google 연결)',
  '프로필 (닉네임·학년·희망 직무)',
  '로드맵 (학기·활동·연결선·활동 기록·직접 만든 종류)',
  '일기와 첨부 파일',
  '펫과 온기 (잔액·누적 온기·출석·일기 보상 기록)',
  'AI 진로 추천 결과',
]

// 회원탈퇴 확인 창
// - 삭제되는 정보와 복구할 수 없다는 점을 보여 주고, 확인란을 체크해야 [탈퇴하기]가 켜진다.
// - 요청 중에는 버튼이 잠겨 중복 클릭이 안 된다. 실패하면 완료로 표시하지 않고 다시 시도할 수 있다.
// - 서버가 모두 삭제했다고 답한 경우에만 완료 안내 → 세션 정리 → 로그인 화면으로 이동한다.
export default function WithdrawDialog({ onClose }) {
  const navigate = useNavigate()
  const [agreed, setAgreed] = useState(false)
  const [status, setStatus] = useState('confirm') // 'confirm' | 'deleting' | 'done'
  const [error, setError] = useState('')
  const inFlight = useRef(false) // 요청 중이면 바로 막는다 (빠른 두 번 클릭 대비)

  // 삭제 중에는 닫히지 않게 (ESC 포함)
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && status === 'confirm') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, onClose])

  async function handleDelete() {
    if (!agreed || status !== 'confirm' || inFlight.current) return
    inFlight.current = true
    setStatus('deleting')
    setError('')
    const result = await deleteMyAccount()
    if (result.error) {
      inFlight.current = false
      setStatus('confirm') // 완료로 표시하지 않는다. 같은 버튼으로 다시 시도
      setError(result.error.message)
      return
    }
    setStatus('done')
    // 완료 안내를 잠깐 보여 준 뒤 세션 정리 → 로그인 화면
    setTimeout(async () => {
      await finishWithdrawal()
      navigate('/login', { replace: true, state: { withdrawn: true } })
    }, 1200)
  }

  return (
    <div className="wd-modal" role="dialog" aria-modal="true" aria-label="회원 탈퇴">
      <div className="wd-modal__backdrop" onClick={status === 'confirm' ? onClose : undefined} />
      <section className="wd-modal__card">
        {status === 'done' ? (
          <div className="wd-done" role="status">
            <strong>탈퇴가 완료되었어요</strong>
            <p>모든 정보를 삭제했어요. 로그인 화면으로 이동합니다.</p>
          </div>
        ) : (
          <>
            <h2 className="wd-title">정말 탈퇴할까요?</h2>
            <p className="wd-lead">탈퇴하면 아래 정보가 <strong>모두 삭제되고 복구할 수 없어요.</strong></p>
            <ul className="wd-list">
              {DELETED_ITEMS.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p className="wd-note">학교 교과과정·공모전·채용 공고 같은 공용 정보와 다른 사용자의 정보는 그대로 남아요.</p>
            <label className="wd-agree">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} disabled={status === 'deleting'} />
              위 내용을 확인했고, 복구할 수 없다는 것에 동의해요.
            </label>
            {error && <p className="wd-error" role="alert">{error}</p>}
            <div className="wd-actions">
              <button type="button" className="wd-btn" onClick={onClose} disabled={status === 'deleting'}>취소</button>
              <button type="button" className="wd-btn wd-btn--danger" onClick={handleDelete} disabled={!agreed || status === 'deleting'}>
                {status === 'deleting' ? '삭제 중…' : error ? '다시 시도' : '탈퇴하기'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

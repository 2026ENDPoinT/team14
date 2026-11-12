import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../features/auth/AuthProvider.jsx'
import { getPet } from '../features/pet/petMock.js'
import PetImage from '../features/pet/PetImage.jsx'
import { getEnergyToNextStage, getStageInfo, getStageProgress, MAX_STAGE } from '../features/pet/petStages.js'
import { PET_CHARACTERS, petAssetUrl, resolvePetCharacter } from '../features/home/petCharacter.js'
import { checkIn, checkPetName, PET_NAME_MAX, renamePet, RENAME_COST } from '../features/home/homeActions.js'
import GrowthDots from '../features/home/GrowthDots.jsx'
import RewardBurst from '../features/home/RewardBurst.jsx'
import '../features/home/Home.css'

// 펫 HOME (/) — Figma HOME 화면: 은은한 크림 배경, 위쪽 가운데 펫 이름, 가운데 펫, 아래 점선 성장 표시
// - 펫 데이터는 아직 Mock(petMock.js). 서버 연결(2-9) 때 services 함수로 바꾼다.
// - 성장 단계는 누적 온기(pet.energy)로 정한다. 온기를 써도 단계는 내려가지 않는다.
// - 출석·이름 변경은 서버 RPC가 없어 "준비 중" 안내만 한다 (가짜 지급·저장·차감 없음)
export default function HomePage() {
  const { profile } = useAuth()
  const [pet, setPet] = useState(() => getPet())
  const [toast, setToast] = useState('')
  const [burst, setBurst] = useState(null) // 서버가 지급을 확인한 온기 (연출 중일 때만)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [nameError, setNameError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)
  const hopRef = useRef(null)
  const endBurst = useCallback(() => setBurst(null), [])

  // 펫 클릭 반응: 살짝 통통 튀고 0.5초 안에 제자리로 (포인트·성장 변화 없음)
  // Web Animations API라 React 다시 그리기가 없고, 연속 클릭하면 이전 동작을 멈추고 처음부터 다시 재생한다.
  function hop() {
    const el = hopRef.current
    if (!el?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.getAnimations().forEach((a) => a.cancel())
    el.animate(
      [
        { transform: 'translateY(0) scale(1, 1)' },
        { transform: 'translateY(0) scale(1.03, 0.97)', offset: 0.15 },
        { transform: 'translateY(-14px) scale(0.99, 1.01)', offset: 0.45 },
        { transform: 'translateY(0) scale(1.02, 0.98)', offset: 0.75 },
        { transform: 'translateY(0) scale(1, 1)' },
      ],
      { duration: 500, easing: 'ease-out' },
    )
  }

  const character = resolvePetCharacter(pet, profile?.interests)
  // 단계: 누적 온기 기준 (서버가 준 stage가 있으면 더 높은 쪽 — 단계는 내려가지 않음)
  const stage = Math.max(pet.stage ?? 1, getStageInfo(pet.energy).stage)
  const maxed = stage >= MAX_STAGE
  const nextMin = getEnergyToNextStage(pet.energy)
  const progress = getStageProgress(pet.energy)
  const imageUrl = petAssetUrl(character, stage)
  const petName = pet.name ?? (character ? PET_CHARACTERS[character].name : '내 펫')
  // 온기 잔액: 서버에 잔액 칸이 생기기 전까지는 누적 온기와 같다 (아직 온기를 쓰는 기능이 없음)
  const balance = pet.warmth ?? pet.energy ?? 0
  const growthLabel = maxed
    ? `${stage}단계 · 최대 성장`
    : `${stage}단계 · 다음 단계까지 누적 온기 ${(nextMin - pet.energy).toLocaleString()} (${progress}%)`

  // 안내 메시지는 2.4초 뒤 사라짐
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  async function handleCheckIn() {
    if (busy) return
    setBusy(true)
    const result = await checkIn()
    setBusy(false)
    if (result.error) {
      setToast(`${result.error.message} 온기는 지급되지 않았어요.`)
      return
    }
    if (result.pet) setPet(result.pet)
    if (result.reward?.rewarded) setBurst(result.reward.energy)
    else setToast('오늘은 이미 출석했어요.')
  }

  function startEdit() {
    setDraft(petName)
    setNameError('')
    setEditing(true)
  }

  async function handleRename(e) {
    e.preventDefault()
    const problem = checkPetName(draft)
    if (problem) {
      setNameError(problem)
      return
    }
    setBusy(true)
    const result = await renamePet(draft.trim())
    setBusy(false)
    if (result.error) {
      // 저장되지 않았으므로 화면의 이름도 그대로 둔다
      setEditing(false)
      setToast(`${result.error.message} 이름이 바뀌지 않았어요.`)
      return
    }
    if (result.pet) setPet(result.pet)
    setEditing(false)
  }

  return (
    <div className="home-page">
      {/* 보유 온기 (오른쪽 위): 햇살 아이콘 + "온기" + 잔액
          ※ 서버에 잔액 칸(warmth_balance)이 생기기 전까지는 Mock 누적 온기(energy)를 그대로 보여 준다 */}
      <div className="hm-warmth" role="group" aria-label={`보유 온기 ${balance.toLocaleString()}`}>
        <svg className="hm-warmth__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        </svg>
        <span className="hm-warmth__label" aria-hidden="true">온기</span>
        <span className="hm-warmth__num" aria-hidden="true">{balance.toLocaleString()}</span>
        {burst !== null && <RewardBurst amount={burst} onDone={endBurst} />}
      </div>

      {/* 펫 이름 (Figma 위치) */}
      <div className="hm-name">
        {editing ? (
          <form className="hm-name__form" onSubmit={handleRename}>
            <input
              ref={inputRef}
              className="hm-name__input"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setNameError('')
              }}
              onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
              aria-label="펫 이름"
              aria-invalid={Boolean(nameError)}
            />
            <span className={`hm-name__count ${[...draft.trim()].length > PET_NAME_MAX ? 'is-over' : ''}`}>
              {[...draft.trim()].length}/{PET_NAME_MAX}
            </span>
            <div className="hm-name__actions">
              <button type="button" className="hm-text-btn" onClick={() => setEditing(false)}>취소</button>
              <button type="submit" className="hm-text-btn is-strong" disabled={busy}>저장</button>
            </div>
            <p className="hm-name__note">{nameError || `첫 변경은 무료, 이후 변경마다 온기 ${RENAME_COST}`}</p>
          </form>
        ) : (
          <>
            <h1 className="hm-name__text">{petName}</h1>
            <button type="button" className="hm-name__edit" aria-label="펫 이름 수정" title="펫 이름 수정" onClick={startEdit}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* 펫 캐릭터: 투명 PNG가 있으면 그 이미지, 없으면 대체 상태
          - 바깥(hop): 클릭 반응 / 안쪽(idle): 숨쉬기 반복 — 두 움직임이 섞이지 않게 요소를 나눔
          - key={imageUrl}: 성장 단계가 바뀌면 새 이미지가 짧게 페이드 인 */}
      <div className="hm-pet" data-character={character ?? 'none'} data-stage={stage}>
        <button type="button" className="hm-pet__hop" ref={hopRef} onClick={hop} aria-label={`${petName} 쓰다듬기`}>
          <span className="hm-pet__idle">
            {imageUrl ? (
              <img key={imageUrl} className="hm-pet__img" src={imageUrl} alt={`${petName} (${stage}단계)`} draggable="false" />
            ) : (
              <span className="hm-pet__fallback" role="img" aria-label={`${petName} ${stage}단계 — 캐릭터 이미지 준비 중`}>
                <span className="hm-pet__shape"><PetImage stage={stage} size={120} /></span>
                <span className="hm-pet__note">
                  {character || stage <= 1 ? '캐릭터 이미지 준비 중' : '펫 종류가 아직 정해지지 않았어요'}
                </span>
              </span>
            )}
          </span>
        </button>
      </div>

      {/* 점선 성장 표시 + 출석 */}
      <div className="hm-bottom">
        <GrowthDots progress={progress} maxed={maxed} label={growthLabel} />
        <button type="button" className="hm-attend" onClick={handleCheckIn} disabled={busy}>
          출석하기
        </button>
      </div>

      <div className={`hm-toast ${toast ? 'is-visible' : ''}`} role="status">{toast}</div>
    </div>
  )
}

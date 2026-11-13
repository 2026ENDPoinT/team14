import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../features/auth/AuthProvider.jsx'
import { EMPTY_PET, usePet } from '../features/pet/petStore.js'
import PetImage from '../features/pet/PetImage.jsx'
import { getEnergyToNextStage, getStageInfo, getStageProgress, MAX_STAGE } from '../features/pet/petStages.js'
import { PET_CHARACTERS, petAssetUrl, resolvePetCharacter } from '../features/home/petCharacter.js'
import { autoCheckIn } from '../features/home/homeActions.js'
import { dropSeenRewards, finishReward, markRewardSeen, seenRewardIds, useRewardQueue } from '../features/home/rewardQueue.js'
import { checkNickname, NICKNAME_COST, NICKNAME_MAX, nicknameLength, saveNickname } from '../features/profile/nickname.js'
import GrowthDots from '../features/home/GrowthDots.jsx'
import WarmthEffect from '../features/diary/WarmthEffect.jsx'
import HomeQuote from '../features/home/HomeQuote.jsx'
import '../features/home/Home.css'

// 펫 HOME (/) — Figma HOME 화면: 은은한 크림 배경, 위쪽 가운데 펫 이름, 가운데 펫, 아래 점선 성장 표시
// - 펫·온기는 서버 값(petStore → pets 테이블). 출석·일기 보상 결과로 바로 갱신된다.
// - 성장 단계는 누적 온기(pet.energy)로 정한다. 온기를 써도 단계는 내려가지 않는다.
// - 출석은 버튼 없이 로그인할 때(AuthProvider)·HOME에 들어올 때 자동으로 서버(check_in)에 요청한다.
//   같은 사용자·날짜에는 요청 하나를 같이 쓴다. 서버가 지급을 확인했을 때만 일기와 같은 연기 연출(온기 +100 획득!)
// - 보상 연출: 서버가 지급을 확인한 보상만 대기열(rewardQueue)에서 하나씩 보여 준다 (화면 이동·다시 그리기에도 한 번)
// - 위쪽 이름은 사용자 닉네임(profiles.nickname). 수정은 서버 RPC(change_nickname)만 — 첫 변경 무료, 이후 온기 300
//   RPC가 없으면 "준비 중" 안내만 한다 (가짜 저장·차감 없음)
export default function HomePage() {
  const { profile, status, applyProfile } = useAuth()
  const userId = status === 'ready' ? profile?.id : null
  const pet = usePet().pet ?? EMPTY_PET // 서버의 내 펫 (누적 온기·잔액). 출석·일기 보상 결과로 바로 갱신된다
  const [toast, setToast] = useState('')
  // 서버가 지급을 확인한 보상 연출 대기열 [{ id, amount }] — 보상이 겹쳐도 하나씩 차례로, 끝까지 재생한 뒤에 뺀다
  // HOME을 연 시점에 이미 본 보상은 첫 화면부터 빼고 보여 준다 (다시 그려질 때 한 순간 깜빡이지 않게)
  const [seenAtOpen] = useState(seenRewardIds)
  const bursts = useRewardQueue().filter((reward) => !seenAtOpen.has(reward.id))
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [nameError, setNameError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)
  const hopRef = useRef(null)
  const burstId = bursts[0]?.id
  const endBurst = useCallback(() => {
    if (burstId) finishReward(burstId)
  }, [burstId])
  // 연출 배지('온기 +100 획득!')가 나온 뒤(2.2초)면 '본 것'으로 친다 → 그 뒤 화면을 떠나도 다시 보여 주지 않음
  useEffect(() => {
    if (!burstId) return undefined
    const timer = setTimeout(() => markRewardSeen(burstId), 2200)
    return () => clearTimeout(timer)
  }, [burstId])
  // HOME을 열 때: 지난번에 충분히 본 연출(도중에 화면을 떠난 것)은 다시 보여 주지 않는다
  useEffect(() => {
    dropSeenRewards()
  }, [])

  // 자동 출석: 로그인·프로필 확인이 끝난 뒤 한 번. 같은 날 같은 사용자는 요청 하나를 같이 쓴다 (homeActions.autoCheckIn)
  // 지급이 확인되면 autoCheckIn이 잔액(petStore)과 연출 대기열(rewardQueue)을 함께 갱신한다.
  // 서버 미준비·오류는 조용히 넘어간다 (오류 안내·가짜 지급 없음)
  useEffect(() => {
    if (userId) autoCheckIn(userId)
  }, [userId])

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
  // 위쪽 이름: 사용자 닉네임 (펫 이름 아님). HOME은 프로필 확인이 끝난 뒤에만 그려진다(RouteGuards)
  const nickname = profile?.nickname?.trim() || ''
  // 펫 이미지 설명용 (화면에 이름으로 보이지 않음)
  const petLabel = character ? PET_CHARACTERS[character].label : '내 펫'
  // 온기 잔액: 서버 pets.warmth_balance (누적 온기 energy와 별개 — 온기를 쓰면 잔액만 줄어든다)
  const balance = pet.warmth ?? 0
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

  function startEdit() {
    setDraft(nickname)
    setNameError('')
    setEditing(true)
  }

  // 닉네임 저장: 서버가 저장·차감을 확인한 뒤에만 화면을 바꾼다 (같은 이름·취소는 서버에 보내지 않음 → 차감 없음)
  async function handleRename(e) {
    e.preventDefault()
    const problem = checkNickname(draft)
    if (problem) {
      setNameError(problem)
      return
    }
    setBusy(true)
    const result = await saveNickname(draft, { current: nickname, applyProfile })
    setBusy(false)
    if (result.error) {
      if (result.code === 'VALIDATION_ERROR') {
        setNameError(result.error)
        return
      }
      // 저장되지 않았으므로 화면의 닉네임·온기도 그대로 둔다
      setEditing(false)
      setToast(`${result.error} 닉네임이 바뀌지 않았어요.`)
      return
    }
    setEditing(false)
    if (result.ok) setToast(result.message)
  }

  return (
    <div className="home-page">
      {/* 출석 온기 획득 연출: 일기 저장 때와 같은 연기 + '온기 +100 획득!' (화면 전체) */}
      {bursts[0] && <WarmthEffect key={bursts[0].id} amount={bursts[0].amount} onDone={endBurst} fullScreen />}
      {/* 보유 온기 (오른쪽 위): 햇살 아이콘 + "온기" + 서버에 저장된 잔액(warmth_balance) */}
      <div className="hm-warmth" role="group" aria-label={`보유 온기 ${balance.toLocaleString()}`}>
        <svg className="hm-warmth__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        </svg>
        <span className="hm-warmth__label" aria-hidden="true">온기</span>
        <span className="hm-warmth__num" aria-hidden="true">{balance.toLocaleString()}</span>
      </div>

      {/* 사용자 닉네임 (Figma의 펫 이름 위치) */}
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
              aria-label="닉네임"
              aria-invalid={Boolean(nameError)}
            />
            <span className={`hm-name__count ${nicknameLength(draft) > NICKNAME_MAX ? 'is-over' : ''}`}>
              {nicknameLength(draft)}/{NICKNAME_MAX}
            </span>
            <div className="hm-name__actions">
              <button type="button" className="hm-text-btn" onClick={() => setEditing(false)}>취소</button>
              <button type="submit" className="hm-text-btn is-strong" disabled={busy}>저장</button>
            </div>
            <p className="hm-name__note">{nameError || `첫 변경은 무료, 이후 변경마다 온기 ${NICKNAME_COST}`}</p>
          </form>
        ) : (
          <>
            <h1 className={`hm-name__text ${nickname ? '' : 'is-empty'}`}>{nickname || '닉네임을 정해 주세요'}</h1>
            <button type="button" className="hm-name__edit" aria-label="닉네임 수정" title="닉네임 수정" onClick={startEdit}>
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
        <button type="button" className="hm-pet__hop" ref={hopRef} onClick={hop} aria-label={`${petLabel} 쓰다듬기`}>
          <span className="hm-pet__idle">
            {imageUrl ? (
              <img key={imageUrl} className="hm-pet__img" src={imageUrl} alt={`${petLabel} (${stage}단계)`} draggable="false" />
            ) : (
              <span className="hm-pet__fallback" role="img" aria-label={`${petLabel} ${stage}단계 — 캐릭터 이미지 준비 중`}>
                <span className="hm-pet__shape"><PetImage stage={stage} size={120} /></span>
                <span className="hm-pet__note">
                  {character || stage <= 1 ? '캐릭터 이미지 준비 중' : '펫 종류가 아직 정해지지 않았어요'}
                </span>
              </span>
            )}
          </span>
        </button>
      </div>

      {/* 점선 성장 표시 + 랜덤 한마디 (출석은 자동이라 버튼 없음) */}
      <div className="hm-bottom">
        <GrowthDots progress={progress} maxed={maxed} label={growthLabel} />
        <HomeQuote />
      </div>

      <div className={`hm-toast ${toast ? 'is-visible' : ''}`} role="status">{toast}</div>
    </div>
  )
}

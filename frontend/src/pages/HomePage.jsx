import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../features/auth/AuthProvider.jsx'
import { EMPTY_PET, usePet } from '../features/pet/petStore.js'
import PetImage from '../features/pet/PetImage.jsx'
import { getEnergyToNextStage, getStageInfo, getStageProgress, MAX_STAGE } from '../features/pet/petStages.js'
import { PET_CHARACTERS, petAssetName, petAssetUrl, petSadAssetUrl, resolvePetCharacter } from '../features/home/petCharacter.js'
import { petFrames } from '../features/home/petFrames.js'
import PetSprite from '../features/home/PetSprite.jsx'
import { autoCheckIn } from '../features/home/homeActions.js'
import { dropSeenRewards, finishReward, markRewardSeen, seenRewardIds, useRewardQueue } from '../features/home/rewardQueue.js'
import { checkNickname, NICKNAME_COST, NICKNAME_MAX, nicknameLength, saveNickname } from '../features/profile/nickname.js'
import GrowthDots from '../features/home/GrowthDots.jsx'
import WarmthEffect from '../features/diary/WarmthEffect.jsx'
import HomeQuote from '../features/home/HomeQuote.jsx'
import PetEffects from '../features/home/PetEffects.jsx'
import { cheerUp, usePetMood } from '../features/pet/petMood.js'
import '../features/pet/petMood.css'
import HomeTutorial from '../features/home/tutorial/HomeTutorial.jsx'
import { recordAutoTutorial, shouldAutoStartTutorial } from '../features/tutorial/autoTutorial.js'
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
  const queued = useRewardQueue().filter((reward) => !seenAtOpen.has(reward.id))
  // HOME 튜토리얼 상태. 자동 튜토리얼을 열 예정이거나 보는 중이면 보상 연출을 잠시 미뤄 둔다 (튜토리얼 → 출석 연출 순서)
  const [tourOpen, setTourOpen] = useState(false)
  const [holdRewards, setHoldRewards] = useState(false) // 자동 튜토리얼을 열 때 true (아래 효과)
  const bursts = holdRewards || tourOpen ? [] : queued
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [nameError, setNameError] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)
  const hopRef = useRef(null)
  const spriteRef = useRef(null) // 펫 부분 애니메이션 (눈 깜빡임·손 흔들기 프레임이 있을 때만)
  const [soilKey, setSoilKey] = useState(0) // 새싹을 누를 때마다 +1 → 흙 알갱이 효과 다시 재생
  // 오래 못 본 펫 (features/pet/petMood.js, 마이페이지 아이콘과 같은 값): 지난 접속(서버 출석 기록, 오늘 제외)에서
  // 3일 이상 → 시들시들·시무룩(gloomy: 머리부터 파랗게·八자 눈썹), 7일 이상 → 꽁꽁 언 모습(cold: 테두리 얼음·언 눈물·처진 입·바람).
  // 펫을 한 번 쓰다듬으면(클릭) 풀린다. 보상·출석 규칙과는 무관 (읽기만 함)
  const { gloomy, cold } = usePetMood(userId)
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

  // HOME 튜토리얼: 신규 가입 후 HOME 첫 방문에만 자동으로 먼저 연다 (서버 프로필 home_tutorial_seen=false, features/tutorial/autoTutorial.js)
  // 출석 보상 연출은 튜토리얼을 닫은 뒤에 나온다 (튜토리얼 → 출석 연출 순서)
  // - 자동으로 여는 순간 서버에 '봤음' 저장 → 도중에 나가도, 다른 기기·재로그인에서도 다시 강제로 띄우지 않는다 (왼쪽 위 ? 버튼으로 다시 보기)
  // - ? 버튼으로 다시 볼 때도 튜토리얼이 열려 있는 동안에는 보상 연출을 미룬다
  useEffect(() => {
    if (!userId || !shouldAutoStartTutorial(profile, 'home')) return undefined
    setHoldRewards(true)
    const timer = setTimeout(() => {
      recordAutoTutorial(profile, 'home', applyProfile)
      setTourOpen(true)
    }, 600)
    return () => clearTimeout(timer)
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps
  const closeTour = useCallback(() => {
    setTourOpen(false)
      setHoldRewards(false)
  }, [])

  // 펫 클릭 반응: 살짝 통통 튀고 0.5초 안에 제자리로 (포인트·성장 변화 없음)
  // Web Animations API라 React 다시 그리기가 없고, 연속 클릭하면 이전 동작을 멈추고 처음부터 다시 재생한다.
  function hop() {
    if (assetName === 'sprout') setSoilKey((k) => k + 1)
    cheerUp() // 쓰다듬어 주면 다시 괜찮아져요 (마이페이지 아이콘도 같이)
    spriteRef.current?.react() // 프레임이 있으면 짧게 손 흔들기(없으면 눈 깜빡임). 프레임이 없으면 아무것도 안 함
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
  // 시무룩할 때 시무룩한 그림 파일(<그림>-sad.png)이 있으면 그 그림, 없으면 원래 그림 + 시무룩한 눈썹
  const sadUrl = gloomy ? petSadAssetUrl(character, stage) : null
  const imageUrl = sadUrl ?? petAssetUrl(character, stage)
  const assetName = imageUrl ? petAssetName(character, stage) : null
  const baseFrames = useMemo(() => petFrames(assetName), [assetName])
  const frames = sadUrl ? [] : baseFrames // 시무룩한 그림에는 깜빡임 프레임이 없다
  // 위쪽 이름: 사용자 닉네임 (펫 이름 아님). HOME은 프로필 확인이 끝난 뒤에만 그려진다(RouteGuards)
  const nickname = profile?.nickname?.trim() || ''
  // 펫 이미지 설명용 (화면에 이름으로 보이지 않음)
  const petLabel = character ? PET_CHARACTERS[character].label : '새싹' // 희망 직무 미정이면 새싹
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
      // 저장되지 않았으므로 화면의 닉네임·온기는 그대로 두고, 편집창과 입력값도 그대로 둔 채 원인을 보여 준다
      // (온기 부족·서버 오류 등도 입력 검증 오류와 같이 입력칸 아래에 표시 → 고쳐서 다시 저장할 수 있다)
      setNameError(result.code === 'VALIDATION_ERROR' ? result.error : `${result.error} 닉네임이 바뀌지 않았어요.`)
      return
    }
    setEditing(false)
    if (result.ok) setToast(result.message)
  }

  return (
    <div className="home-page">
      {/* 왼쪽 위: 서비스 로고(로그인 화면과 같은 글꼴, 누르면 새로고침) */}
      <div className="hm-topleft">
        <button type="button" className="hm-logo" onClick={() => window.location.reload()} aria-label="Momentree 새로고침" title="새로고침">
          Momentree
        </button>
      </div>
      <HomeTutorial open={tourOpen} onClose={closeTour} />
      {/* 출석 온기 획득 연출: 일기 저장 때와 같은 연기 + '온기 +100 획득!' (화면 전체) */}
      {bursts[0] && <WarmthEffect key={bursts[0].id} amount={bursts[0].amount} onDone={endBurst} fullScreen />}
      {/* 오른쪽 위: 보유 온기(햇살 아이콘 + "온기" + 서버에 저장된 잔액 warmth_balance) + 그 왼쪽에 HOME 사용법 다시 보기(?) */}
      <div className="hm-topright">
        <button type="button" className="hm-help" onClick={() => setTourOpen(true)} aria-label="HOME 사용법 보기" title="HOME 사용법 보기">?</button>
      <div className="hm-warmth" role="group" aria-label={`보유 온기 ${balance.toLocaleString()}`}>
        <svg className="hm-warmth__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        </svg>
        <span className="hm-warmth__label" aria-hidden="true">온기</span>
        <span className="hm-warmth__num" aria-hidden="true">{balance.toLocaleString()}</span>
      </div>
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
            <p className={`hm-name__note ${nameError ? 'is-error' : ''}`} role={nameError ? 'alert' : undefined}>
              {nameError || `첫 변경은 무료, 이후 변경마다 온기 ${NICKNAME_COST}`}
            </p>
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
      <div className={`hm-pet ${gloomy ? 'is-gloomy' : ''} ${cold ? 'is-cold' : ''}`} data-character={character ?? 'none'} data-stage={stage}>
        <button type="button" className="hm-pet__hop" ref={hopRef} onClick={hop} aria-label={`${petLabel} 쓰다듬기`}>
          <span className="hm-pet__idle">
            {imageUrl ? (
              <PetSprite ref={spriteRef} src={imageUrl} frames={frames} alt={`${petLabel} (${stage}단계)`} />
            ) : (
              <span className="hm-pet__fallback" role="img" aria-label={`${petLabel} ${stage}단계 — 캐릭터 이미지 준비 중`}>
                <span className="hm-pet__shape"><PetImage stage={stage} size={120} /></span>
                <span className="hm-pet__note">
                  {character || stage <= 1 ? '캐릭터 이미지 준비 중' : '펫 종류가 아직 정해지지 않았어요'}
                </span>
              </span>
            )}
          </span>
          {/* 펫 위 효과: 새싹 흙 알갱이 · 3일 이상 못 본 뒤 머리부터 파랗게·시무룩한 눈썹 · 7일 이상 꽁꽁 언 얼음·바람 (원본 그림은 그대로) */}
          <PetEffects hostRef={hopRef} assetName={assetName} soilKey={soilKey} cold={cold} brows={gloomy && !sadUrl} tintSrc={gloomy && !cold ? imageUrl : null} frozenSrc={cold ? imageUrl : null} frozenFace={!sadUrl} />
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

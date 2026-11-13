import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PetImage from '../pet/PetImage.jsx'
import { getEnergyToNextStage, getStageByNumber, getStageInfo, getStageProgress } from '../pet/petStages.js'
import { listDiaries, useDiaries } from '../diary/diaryStore.js'
import { getTodayKST } from '../diary/dateUtils.js'
import { Group, LinkRow, PanelTitle, Row, Segment, Toggle } from './ui.jsx'
import JobPicker from './JobPicker.jsx'
import { jobTitle } from './jobGroups.js'
import { JOB_TO_PET, PET_CHARACTERS, petAssetName, petAssetUrl, petSadAssetUrl, resolvePetCharacter } from '../home/petCharacter.js'
import { usePetMood } from '../pet/petMood.js'
import SadBrows from '../pet/SadBrows.jsx'
import SadTint from '../pet/SadTint.jsx'
import FrozenPet from '../pet/FrozenPet.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import WithdrawDialog from './WithdrawDialog.jsx'
import { NICKNAME_COST, NICKNAME_MAX } from '../profile/nickname.js'
import { exportMyRecords } from './exportRecords.js'
import { canNotify, showDiaryNotification } from '../diary/DiaryReminder.jsx'

// 마이페이지 오른쪽 화면들. 왼쪽 메뉴에서 고른 것 하나만 보인다.
// 닉네임·학년·이메일·희망 직무·일기·펫은 서버 값. 설정은 이 브라우저에 저장(settingsStore). 일기 알림은 브라우저 알림(DiaryReminder)

// 펫 아이콘 동그라미 (학기 배지와 같은 연노랑)
// 희망 직무 → 펫 종류(펭귄·수달·검은 고양이·햄스터·토끼), 단계 → 이미지 (HOME과 같은 그림)
// - 1단계(새싹)는 모든 직무 공통 그림, 2~4단계(아기·꼬마·어른 펫)는 펫 종류마다 다른 그림
// - 단계는 누적 온기 기준 (서버 stage가 더 높으면 그 값 — HOME·일기와 같은 규칙)
// - 직무가 '아직 정하지 않음'이라 펫 종류를 모르면 임시 아이콘(PetImage)
// - 3일 이상 접속하지 않았으면 HOME 펫과 같이 시들시들·시무룩, 7일 이상이면 꽁꽁 언 모습 (features/pet/petMood.js, HOME에서 쓰다듬으면 풀림)
export function Avatar({ pet, job, size = 84 }) {
  const { profile, status } = useAuth()
  const { gloomy, cold } = usePetMood(status === 'ready' ? profile?.id : null)
  const stage = petStage(pet)
  const character = resolvePetCharacter(pet, job ? [job] : [])
  const sadUrl = gloomy ? petSadAssetUrl(character, stage) : null // 시무룩한 그림 파일이 있으면 그 그림
  const imageUrl = sadUrl ?? petAssetUrl(character, stage)
  const label = character ? `${PET_CHARACTERS[character].label} ${getStageByNumber(stage).name}` : getStageByNumber(stage).name
  return (
    <span className="mp-avatar" style={{ width: size, height: size }}>
      {imageUrl ? (
        // 그림과 같은 크기의 상자 안에 눈썹을 겹친다 (위치가 그림 비율이라 상자 = 그림이어야 함)
        <span className={`mp-avatar__pet ${gloomy ? 'is-gloomy' : ''} ${cold ? 'is-cold' : ''}`} style={{ width: Math.round(size * 0.8) }}>
          <img className="mp-avatar__img" src={imageUrl} alt={`내 펫: ${label}${gloomy ? ' (시무룩)' : ''}`} />
          {gloomy && !cold && <SadTint src={imageUrl} />}
          {cold && <FrozenPet src={imageUrl} assetName={petAssetName(character, stage)} face={!sadUrl} />}
          {gloomy && !sadUrl && <SadBrows assetName={petAssetName(character, stage)} />}
        </span>
      ) : (
        <PetImage stage={stage} size={Math.round(size * 0.76)} />
      )}
    </span>
  )
}

// 펫 단계 (누적 온기 기준, 서버 stage가 더 높으면 그 값)
function petStage(pet) {
  return Math.max(pet?.stage ?? 1, getStageInfo(pet?.energy ?? 0).stage)
}

// 프로필 바: 펫 아이콘 + 닉네임 + 학년 (+ 오른쪽 버튼)
function ProfileBar({ profile, pet, action }) {
  return (
    <div className="mp-profile">
      <Avatar pet={pet} job={profile.desiredJob} />
      <div className="mp-profile__text">
        <p className="mp-profile__name">{profile.nickname}</p>
        <p className="mp-profile__univ">{profile.grade}학년</p>
      </div>
      {action}
    </div>
  )
}

// ── 계정 센터 (하위 화면: 프로필 / 연결된 계정) ──
export function AccountPanel({ profile, pet }) {
  const [withdrawOpen, setWithdrawOpen] = useState(false) // 회원 탈퇴 확인 창
  // 로그아웃: 기존 AuthProvider의 logout. 성공하면 라우트 가드가 로그인 화면으로 보낸다
  const { logout } = useAuth()
  const handleLogout = async () => {
    const result = await logout()
    if (result?.error) window.alert('로그아웃하지 못했어요. 잠시 후 다시 시도해 주세요.')
  }
  const [sub, setSub] = useState(null) // 열린 하위 화면
  const back = () => setSub(null)

  if (sub === 'personal') {
    return (
      <>
        <PanelTitle title="프로필" onBack={back} />
        <Group>
          <Row label="닉네임" value={profile.nickname} />
          <Row label="학년" value={`${profile.grade}학년`} />
        </Group>
        <p className="rm-muted">닉네임·학년은 '프로필 편집'에서 바꿀 수 있어요.</p>
      </>
    )
  }
  if (sub === 'connected') {
    return (
      <>
        <PanelTitle title="연결된 계정" onBack={back} />
        <Group>
          <Row label="로그인 이메일" hint={profile.email || '알 수 없음'} />
        </Group>
        {/* [미확정] 로그인 방식(이메일·Google) 표시는 프로필 조회에 정보가 없어 3번과 협의 필요 */}
        <p className="rm-muted">이메일 또는 Google 계정으로 로그인한 주소예요.</p>
      </>
    )
  }
  return (
    <>
      <PanelTitle title="계정 센터" desc="로그인 정보와 계정 설정을 한곳에서 관리해 보세요." />
      <div className="mp-card">
        <button type="button" className="mp-row mp-row--link mp-row--big" onClick={() => setSub('personal')}>
          <Avatar pet={pet} job={profile.desiredJob} size={56} />
          <div className="mp-row__text">
            <p className="mp-row__label">프로필</p>
            <p className="mp-row__hint">{profile.nickname} · {profile.grade}학년</p>
          </div>
          <ChevronOnly />
        </button>
      </div>
      <Group title="계정 설정">
        <LinkRow icon="link" label="연결된 계정" onClick={() => setSub('connected')} />
      </Group>
      <Group>
        <LinkRow icon="logout" label="로그아웃" onClick={handleLogout} />
        <LinkRow icon="leave" label="회원 탈퇴" onClick={() => setWithdrawOpen(true)} danger />
      </Group>
      {withdrawOpen && <WithdrawDialog onClose={() => setWithdrawOpen(false)} />}
    </>
  )
}
function ChevronOnly() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

// ── 프로필 편집: 닉네임·학년·희망 직무 ──
// 희망 직무를 고르면 바로 확인 창이 뜬다. (기획 피드백 순서)
//  1) 현재 학기 이후 과목을 새 직무에 맞게 재설정할지 (예/아니오)
//  2) 새 직무에 맞는 펫 안내 (펫은 직무에 따라 자동으로 바뀌고 온기·성장 단계는 유지)
//  → 확인하면 희망 직무가 바뀐다. 중간에 취소하면 아무것도 바뀌지 않는다.
// 닉네임·학년은 '저장' 버튼으로 저장한다. 닉네임은 서버 RPC(change_nickname)로만 바뀐다.
//   실패하면 입력값을 그대로 두고 원인을 입력칸 아래에 보여 준다. 저장 중에는 버튼을 막는다 (중복 차감 방지)
export function ProfilePanel({ profile, pet, onSave }) {
  const [draft, setDraft] = useState(profile)
  const [pendingJob, setPendingJob] = useState(null) // 확인 창에서 묻는 중인 새 직무
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState('')
  const set = (key) => (e) => {
    setDraft((d) => ({ ...d, [key]: e.target.value }))
    if (key === 'nickname') setNameError('')
  }
  const nickname = draft.nickname.trim()

  // 서버에 저장된 닉네임이 바뀌면(저장 성공) 입력칸도 그 값으로 맞춘다
  useEffect(() => {
    setDraft((d) => ({ ...d, nickname: profile.nickname }))
  }, [profile.nickname])

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setNameError('')
    const result = await onSave({ ...profile, nickname, grade: Number(draft.grade) })
    setSaving(false)
    if (result?.error) setNameError(`${result.error} 닉네임이 바뀌지 않았어요.`)
  }

  function pickJob(jobId) {
    if (jobId !== profile.desiredJob) setPendingJob(jobId)
  }

  return (
    <>
      <PanelTitle title="프로필 편집" />
      <ProfileBar profile={profile} pet={pet} />
      <label className="mp-field">
        <span className="mp-field__label">닉네임</span>
        <input className="dy-input mp-input" value={draft.nickname} onChange={set('nickname')} maxLength={NICKNAME_MAX * 2} aria-label="닉네임" />
        <span className="mp-field__note">최대 {NICKNAME_MAX}자 · 첫 변경은 무료, 이후 변경마다 온기 {NICKNAME_COST}</span>
        {nameError && <span className="mp-field__note is-error" role="alert">{nameError}</span>}
      </label>
      <label className="mp-field">
        <span className="mp-field__label">학년</span>
        <select className="dy-input mp-input" value={draft.grade} onChange={set('grade')}>
          {[1, 2, 3, 4].map((g) => <option key={g} value={g}>{g}학년</option>)}
        </select>
      </label>
      <div className="mp-field">
        <span className="mp-field__label">희망 직무</span>
        <JobPicker value={profile.desiredJob} onChange={pickJob} />
        <span className="mp-field__note">직무를 바꾸면 과목·펫을 어떻게 할지 먼저 물어봐요.</span>
      </div>
      <div className="dp-actions">
        <button
          type="button"
          className="dp-btn dp-btn--accent"
          onClick={handleSave}
          disabled={!nickname || saving}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>

      {pendingJob && (
        <JobChangeDialog
          profile={profile}
          newJob={pendingJob}
          onCancel={() => setPendingJob(null)}
          onConfirm={(choices) => {
            setPendingJob(null)
            onSave({ ...profile, desiredJob: pendingJob }, choices)
          }}
        />
      )}
    </>
  )
}

// 희망 직무 변경 확인 창 (2단계: 과목 → 펫 안내, 확인하면 직무 변경)
// ※ 과목 재설정은 서버(3번)·로드맵(1번)·과목 선정(4번) 기능이 필요해 지금은 선택만 받는다.
function JobChangeDialog({ profile, newJob, onCancel, onConfirm }) {
  const [resetCourses, setResetCourses] = useState(null) // null: 아직 안 고름 / true: 재설정 / false: 그대로
  const step = resetCourses === null ? 1 : 2
  const oldPet = JOB_TO_PET[profile.desiredJob]
  const newPet = JOB_TO_PET[newJob]

  return (
    <div className="dp-modal" role="dialog" aria-modal="true" aria-label="희망 직무 변경">
      <div className="dp-modal__backdrop" onClick={onCancel} />
      <section className="dp-photo mp-dialog">
        {/* 한 줄로 (아주 긴 직무 이름은 끝을 … 로 줄이고, 마우스를 올리면 전체가 보인다) */}
        <p
          className="rm-eyebrow mp-dialog__eyebrow"
          title={`희망 직무 변경 · ${jobTitle(profile.desiredJob)} → ${jobTitle(newJob)}`}
        >
          희망 직무 변경 · {jobTitle(profile.desiredJob)} → {jobTitle(newJob)}
        </p>
        <div className="mp-dialog__steps" aria-label={`${step}/2단계`}>
          {[1, 2].map((n) => <span key={n} className={n <= step ? 'is-on' : ''} />)}
        </div>

        {step === 1 && (
          <>
            <h3 className="dp-photo__title">현재 학기 이후 과목을 희망 직무에 맞게 재설정하시겠습니까?</h3>
            <p className="rm-muted dp-photo__sub">이미 들은 과목과 지금 학기 과목은 그대로 남아요.</p>
            <div className="mp-dialog__choices">
              <button type="button" className="dp-btn dp-btn--soft" onClick={() => setResetCourses(false)}>아니오</button>
              <button type="button" className="dp-btn dp-btn--accent" onClick={() => setResetCourses(true)}>예</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            {/* 펫은 희망 직무에 맞게 자동으로 바뀌고, 온기·성장 단계는 초기화하지 않는다 */}
            <h3 className="dp-photo__title">
              {!newPet
                ? '이 직무는 아직 펫을 정할 수 없어요'
                : oldPet === newPet
                  ? `펫은 그대로 ${PET_CHARACTERS[newPet].name}예요`
                  : `펫이 ${PET_CHARACTERS[newPet].name}(${PET_CHARACTERS[newPet].label})로 바뀌어요`}
            </h3>
            <p className="rm-muted dp-photo__sub">모은 온기와 성장 단계는 그대로 이어져요.</p>
            <div className="mp-dialog__choices">
              <button type="button" className="dp-btn dp-btn--accent" onClick={() => onConfirm({ resetCourses })}>직무 바꾸기</button>
            </div>
            <button type="button" className="dp-text-btn mp-dialog__prev" onClick={() => setResetCourses(null)}>
              ← 과목 선택 다시 하기
            </button>
          </>
        )}

        <button type="button" className="dp-text-btn mp-dialog__cancel" onClick={onCancel}>취소</button>
      </section>
    </div>
  )
}

// ── 알림: 일기 쓰기 알림 (브라우저 알림, DiaryReminder.jsx가 시간에 맞춰 보냄) ──
// 켜면 브라우저에 알림 권한을 묻는다. 사이트가 탭에 열려 있을 때만 알림이 온다.
export function NoticePanel({ settings, update }) {
  const supported = canNotify()
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported')

  async function toggleReminder(on) {
    if (on && supported && Notification.permission === 'default') {
      setPermission(await Notification.requestPermission())
    }
    update('diaryReminder', on)
  }

  const blocked = permission === 'denied'
  return (
    <>
      <PanelTitle title="알림" desc="일기 쓰는 걸 잊지 않도록 알려 드려요." />
      <Group title="일기">
        <Row label="일기 쓰기 알림" hint="정한 시간까지 오늘 일기가 없으면 한 번 알려 드려요">
          <Toggle label="일기 쓰기 알림" on={settings.diaryReminder} onChange={toggleReminder} />
        </Row>
        {settings.diaryReminder && (
          <Row label="알림 시간">
            <input
              type="time"
              className="mp-time"
              value={settings.diaryReminderTime}
              onChange={(e) => update('diaryReminderTime', e.target.value)}
            />
          </Row>
        )}
        {settings.diaryReminder && permission === 'granted' && (
          <LinkRow icon="bell" label="테스트 알림 보내기" hint="알림이 어떻게 오는지 바로 확인" onClick={() => showDiaryNotification()} />
        )}
      </Group>
      {!supported && <p className="rm-muted">이 브라우저는 알림을 지원하지 않아요.</p>}
      {blocked && (
        <p className="rm-muted">
          브라우저에서 알림이 차단돼 있어요. 주소창 왼쪽 자물쇠(🔒) → 알림 → 허용으로 바꿔 주세요.
        </p>
      )}
      <p className="rm-muted">※ 우리 사이트가 브라우저 탭에 열려 있을 때만 알림이 와요. 설정은 이 브라우저에 저장돼요.</p>
    </>
  )
}

// ── 화면 설정 ──
export function DisplayPanel({ settings, update }) {
  return (
    <>
      <PanelTitle title="화면 설정" />
      <p className="rm-muted">※ 설정은 이 브라우저에 저장돼요.</p>
      <Group title="테마">
        <Row label="화면 모드" hint="선택한 모드는 홈·로드맵·일기·탐색 등 전체 화면에 적용돼요.">
          <Segment
            value={['dark', 'ocean'].includes(settings.theme) ? settings.theme : 'light'}
            options={[[ 'light', '☀ 라이트' ], [ 'dark', '☾ 다크' ], [ 'ocean', '≋ 바다' ]]}
            onChange={(v) => update('theme', v)}
          />
        </Row>
      </Group>
      <Group>
        <Row label="달력 시작 요일" hint="일기 달력이 시작하는 요일">
          <Segment
            value={settings.weekStart}
            options={[['sun', '일요일'], ['mon', '월요일']]}
            onChange={(v) => update('weekStart', v)}
          />
        </Row>
      </Group>
    </>
  )
}

// ── 내 활동: 내 기록 요약 (다른 사용자와 비교하지 않음) ──
export function ActivityPanel({ profile, pet }) {
  useDiaries() // 내 일기를 서버에서 불러온다
  const today = getTodayKST()
  const allDiaries = listDiaries('0000-01-01', today)
  const monthDiaries = allDiaries.filter((d) => d.date.startsWith(today.slice(0, 7)))
  const recent = [...allDiaries].reverse().slice(0, 3)
  // 단계: 누적 온기 기준 (서버 stage가 더 높으면 그 값 — 일기·HOME과 같은 규칙)
  const stage = getStageByNumber(petStage(pet))
  const nextMin = getEnergyToNextStage(pet.energy) // 다음 단계 기준 (최고 단계면 null)

  return (
    <>
      <PanelTitle title="내 활동" desc="지금까지 남긴 기록을 모아 봤어요." />
      <div className="mp-stats">
        <Stat label="이번 달 일기" value={`${monthDiaries.length}일`} />
        <Stat label="전체 일기" value={`${allDiaries.length}개`} />
        <Stat label="누적 온기" value={pet.energy.toLocaleString()} />
      </div>

      <Group title="나의 펫">
        <div className="mp-pet">
          <Avatar pet={pet} job={profile?.desiredJob} size={64} />
          <div className="mp-pet__info">
            <p className="mp-row__label">{stage.stage}단계 · {stage.name}</p>
            <div className="dy-bar" aria-hidden="true">
              <div className="dy-bar__fill" style={{ width: `${getStageProgress(pet.energy)}%` }} />
            </div>
            <p className="mp-row__hint">
              {nextMin !== null ? `다음 단계까지 온기 ${(nextMin - pet.energy).toLocaleString()}` : '최고 단계예요'}
            </p>
          </div>
        </div>
      </Group>

      <Group title="최근 일기">
        {recent.length === 0 && <Row label="아직 쓴 일기가 없어요" />}
        {recent.map((d) => (
          <Link key={d.date} to={`/diary?date=${d.date}&from=mypage&tab=activity`} className="mp-row mp-row--link mp-recent">
            <span className="mp-recent__date">{d.date.slice(5).replace('-', '.')}</span>
            <p className="mp-recent__text">{d.content || '(내용 없음)'}</p>
            <ChevronOnly />
          </Link>
        ))}
      </Group>
    </>
  )
}
function Stat({ label, value }) {
  return (
    <div className="mp-stat">
      <p className="mp-row__hint">{label}</p>
      <strong className="mp-stat__value">{value}</strong>
    </div>
  )
}

// ── 기록 관리 ──
export function RecordsPanel({ profile, showToast }) {
  const [exporting, setExporting] = useState(false)

  // 일기·로드맵을 PDF로 저장 (인쇄 창에서 'PDF로 저장' 선택)
  async function handleExport() {
    if (exporting) return
    setExporting(true)
    const result = await exportMyRecords(profile)
    setExporting(false)
    showToast(result.error ? `내보내지 못했어요. ${result.error.message}` : "인쇄 창에서 '대상: PDF로 저장'을 골라 주세요.")
  }

  return (
    <>
      <PanelTitle title="기록 관리" />
      <Group>
        <LinkRow icon="activity" label="일기장 열기" to="/diary?from=mypage&tab=records" />
        <LinkRow icon="archive" label="로드맵 보관함" hint="로드맵 화면에서 보관함을 열어 보세요" to="/roadmap" />
        <LinkRow
          icon="info"
          label={exporting ? '내보내는 중…' : '내 기록 내보내기'}
          hint="일기·로드맵을 PDF 파일로 저장"
          onClick={handleExport}
        />
      </Group>
    </>
  )
}

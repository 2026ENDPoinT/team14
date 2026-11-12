import { useState } from 'react'
import { Link } from 'react-router-dom'
import PetImage from '../pet/PetImage.jsx'
import { getStageByNumber, getStageProgress } from '../pet/petStages.js'
import { listDiaries, useDiaries } from '../diary/diaryStore.js'
import { getTodayKST } from '../diary/dateUtils.js'
import { Group, LinkRow, PanelTitle, Row, Segment, Toggle } from './ui.jsx'
import JobPicker from './JobPicker.jsx'
import { jobTitle } from './jobGroups.js'
import { JOB_TO_PET, PET_CHARACTERS } from '../home/petCharacter.js'
import { useAuth } from '../auth/AuthProvider.jsx'
import WithdrawDialog from './WithdrawDialog.jsx'

// 마이페이지 오른쪽 화면들. 왼쪽 메뉴에서 고른 것 하나만 보인다.
// 모두 Mock 데이터 기반이며, 실제 저장·인증은 3번(인증·서비스) 연동 때 연결한다.

// 펫 아이콘 동그라미 (학기 배지와 같은 연노랑)
// ※ 나중에 단계에 맞는 펫 이미지(5가지 중 1개)가 들어갈 자리. 지금은 임시 아이콘(PetImage)
export function Avatar({ stage, size = 84 }) {
  return (
    <span className="mp-avatar" style={{ width: size, height: size }}>
      <PetImage stage={stage} size={Math.round(size * 0.76)} />
    </span>
  )
}

// 프로필 바: 펫 아이콘 + 닉네임 + 학년 (+ 오른쪽 버튼)
function ProfileBar({ profile, pet, action }) {
  return (
    <div className="mp-profile">
      <Avatar stage={pet.stage} />
      <div className="mp-profile__text">
        <p className="mp-profile__name">{profile.nickname}</p>
        <p className="mp-profile__univ">{profile.grade}학년</p>
      </div>
      {action}
    </div>
  )
}

// ── 계정 센터 (하위 화면: 프로필 / 연결된 계정 / 내 정보) ──
export function AccountPanel({ profile, pet, notReady }) {
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
          <Row label="Google" hint={profile.loginProvider === 'google' ? profile.email : '연결 안 됨'}>
            <span className="mp-chip">{profile.loginProvider === 'google' ? '연결됨' : '연결하기'}</span>
          </Row>
        </Group>
      </>
    )
  }
  if (sub === 'data') {
    return (
      <>
        <PanelTitle title="내 정보 및 권한" onBack={back} />
        <Group>
          <LinkRow icon="info" label="내 기록 내보내기" hint="일기·로드맵을 파일로 저장" onClick={notReady} />
        </Group>
        <p className="rm-muted">내 기록은 나만 볼 수 있어요. 다른 사용자에게 보이지 않아요.</p>
      </>
    )
  }

  return (
    <>
      <PanelTitle title="계정 센터" desc="로그인 정보와 계정 설정을 한곳에서 관리해 보세요." />
      <div className="mp-card">
        <button type="button" className="mp-row mp-row--link mp-row--big" onClick={() => setSub('personal')}>
          <Avatar stage={pet.stage} size={56} />
          <div className="mp-row__text">
            <p className="mp-row__label">프로필</p>
            <p className="mp-row__hint">{profile.nickname} · {profile.grade}학년</p>
          </div>
          <ChevronOnly />
        </button>
      </div>
      <Group title="계정 설정">
        <LinkRow icon="link" label="연결된 계정" onClick={() => setSub('connected')} />
        <LinkRow icon="info" label="내 정보 및 권한" onClick={() => setSub('data')} />
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
// 닉네임·학년은 '저장' 버튼으로 저장한다.
export function ProfilePanel({ profile, pet, onSave }) {
  const [draft, setDraft] = useState(profile)
  const [pendingJob, setPendingJob] = useState(null) // 확인 창에서 묻는 중인 새 직무
  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }))
  const nickname = draft.nickname.trim()

  function pickJob(jobId) {
    if (jobId !== profile.desiredJob) setPendingJob(jobId)
  }

  return (
    <>
      <PanelTitle title="프로필 편집" />
      <ProfileBar profile={profile} pet={pet} />
      <label className="mp-field">
        <span className="mp-field__label">닉네임</span>
        <input className="dy-input mp-input" value={draft.nickname} onChange={set('nickname')} maxLength={20} />
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
          onClick={() => onSave({ ...profile, nickname, grade: Number(draft.grade) })}
          disabled={!nickname}
        >
          저장
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
  const term = `${profile.grade}학년 ${profile.semester}학기`
  const oldPet = JOB_TO_PET[profile.desiredJob]
  const newPet = JOB_TO_PET[newJob]

  return (
    <div className="dp-modal" role="dialog" aria-modal="true" aria-label="희망 직무 변경">
      <div className="dp-modal__backdrop" onClick={onCancel} />
      <section className="dp-photo mp-dialog">
        <p className="rm-eyebrow">
          희망 직무 변경 · {jobTitle(profile.desiredJob)} → {jobTitle(newJob)}
        </p>
        <div className="mp-dialog__steps" aria-label={`${step}/2단계`}>
          {[1, 2].map((n) => <span key={n} className={n <= step ? 'is-on' : ''} />)}
        </div>

        {step === 1 && (
          <>
            <h3 className="dp-photo__title">{term} 이후 과목을 희망 직무에 맞게 재설정하시겠습니까?</h3>
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

// ── 알림 ──
export function NoticePanel({ settings, update }) {
  return (
    <>
      <PanelTitle title="알림" desc="기록을 잊지 않도록 알려 드려요." />
      <Group title="일기">
        <Row label="일기 쓰기 알림" hint="매일 정한 시간에 알려 드려요">
          <Toggle label="일기 쓰기 알림" on={settings.diaryReminder} onChange={(v) => update('diaryReminder', v)} />
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
      </Group>
      <Group title="출석 · 회고">
        <Row label="출석 알림" hint="오늘 출석을 아직 안 했을 때">
          <Toggle label="출석 알림" on={settings.attendanceReminder} onChange={(v) => update('attendanceReminder', v)} />
        </Row>
        <Row label="학기 회고 알림" hint="학기가 끝날 때 돌아보기">
          <Toggle label="학기 회고 알림" on={settings.reflectionReminder} onChange={(v) => update('reflectionReminder', v)} />
        </Row>
      </Group>
    </>
  )
}

// ── 화면 설정 ──
export function DisplayPanel({ settings, update }) {
  return (
    <>
      <PanelTitle title="화면 설정" />
      <Group>
        <Row label="시작 화면" hint="로그인하면 처음 보이는 화면">
          <Segment
            value={settings.startPage}
            options={[['/', '홈'], ['/roadmap', '로드맵'], ['/diary', '일기']]}
            onChange={(v) => update('startPage', v)}
          />
        </Row>
        <Row label="달력 시작 요일">
          <Segment
            value={settings.weekStart}
            options={[['sun', '일요일'], ['mon', '월요일']]}
            onChange={(v) => update('weekStart', v)}
          />
        </Row>
        <Row label="움직임 줄이기" hint="화면 애니메이션을 최소로">
          <Toggle label="움직임 줄이기" on={settings.reduceMotion} onChange={(v) => update('reduceMotion', v)} />
        </Row>
      </Group>
    </>
  )
}

// ── 내 활동: 내 기록 요약 (다른 사용자와 비교하지 않음) ──
export function ActivityPanel({ pet }) {
  useDiaries() // 내 일기를 서버에서 불러온다
  const today = getTodayKST()
  const allDiaries = listDiaries('0000-01-01', today)
  const monthDiaries = allDiaries.filter((d) => d.date.startsWith(today.slice(0, 7)))
  const recent = [...allDiaries].reverse().slice(0, 3)
  const stage = getStageByNumber(pet.stage)

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
          <Avatar stage={pet.stage} size={64} />
          <div className="mp-pet__info">
            <p className="mp-row__label">{stage.stage}단계 · {stage.name}</p>
            <div className="dy-bar" aria-hidden="true">
              <div className="dy-bar__fill" style={{ width: `${getStageProgress(pet.energy)}%` }} />
            </div>
            <p className="mp-row__hint">
              {pet.energyToNextStage ? `다음 단계까지 온기 ${(pet.energyToNextStage - pet.energy).toLocaleString()}` : '최고 단계예요'}
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
export function RecordsPanel({ notReady }) {
  return (
    <>
      <PanelTitle title="기록 관리" />
      <Group>
        <LinkRow icon="activity" label="일기장 열기" to="/diary?from=mypage&tab=records" />
        <LinkRow icon="archive" label="로드맵 보관함" hint="삭제한 학기의 활동·문서" onClick={notReady} />
        <LinkRow icon="info" label="내 기록 내보내기" hint="일기·로드맵을 파일로 저장" onClick={notReady} />
      </Group>
    </>
  )
}

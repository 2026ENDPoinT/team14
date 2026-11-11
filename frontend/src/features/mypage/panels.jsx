import { useState } from 'react'
import { Link } from 'react-router-dom'
import PetImage from '../pet/PetImage.jsx'
import { getStageByNumber, getStageProgress } from '../pet/petStages.js'
import { listDiaries } from '../diary/diaryMock.js'
import { getTodayKST } from '../diary/dateUtils.js'
import { Group, LinkRow, PanelTitle, Row, Segment, Toggle } from './ui.jsx'

// 마이페이지 오른쪽 화면들. 왼쪽 메뉴에서 고른 것 하나만 보인다.
// 모두 Mock 데이터 기반이며, 실제 저장·인증은 3번(인증·서비스) 연동 때 연결한다.

// 펫 아이콘 동그라미 (학기 배지와 같은 연노랑)
export function Avatar({ stage, size = 84 }) {
  return (
    <span className="mp-avatar" style={{ width: size, height: size }}>
      <PetImage stage={stage} size={Math.round(size * 0.76)} />
    </span>
  )
}

// 프로필 바: 펫 아이콘 + 이름 + 소속 대학 (+ 오른쪽 버튼)
function ProfileBar({ profile, pet, action }) {
  return (
    <div className="mp-profile">
      <Avatar stage={pet.stage} />
      <div className="mp-profile__text">
        <p className="mp-profile__name">{profile.nickname}</p>
        <p className="mp-profile__univ">{profile.university}</p>
      </div>
      {action}
    </div>
  )
}

// ── 계정 센터 (하위 화면: 개인정보 / 보안 / 연결된 계정 / 내 정보) ──
export function AccountPanel({ profile, pet, notReady }) {
  const [sub, setSub] = useState(null) // 열린 하위 화면
  const back = () => setSub(null)

  if (sub === 'personal') {
    return (
      <>
        <PanelTitle title="프로필 및 개인정보" onBack={back} />
        <Group>
          <Row label="이름" value={profile.nickname} />
          <Row label="이메일" value={profile.email} />
          <Row label="소속 대학" value={profile.university} />
        </Group>
        <p className="rm-muted">이름·소속 대학은 '프로필 편집'에서 바꿀 수 있어요.</p>
      </>
    )
  }
  if (sub === 'security') {
    const isGoogle = profile.loginProvider === 'google'
    return (
      <>
        <PanelTitle title="비밀번호 및 보안" onBack={back} />
        <Group>
          <Row label="로그인 방식"><span className="mp-chip">{isGoogle ? 'Google 계정' : '이메일'}</span></Row>
          {isGoogle
            ? <Row label="비밀번호" hint="Google 계정에서 관리해요" value="-" />
            : <LinkRow label="비밀번호 변경" onClick={notReady} />}
        </Group>
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
            <p className="mp-row__label">프로필 및 개인정보</p>
            <p className="mp-row__hint">{profile.nickname} · {profile.university}</p>
          </div>
          <ChevronOnly />
        </button>
      </div>
      <Group title="계정 설정">
        <LinkRow icon="shield" label="비밀번호 및 보안" onClick={() => setSub('security')} />
        <LinkRow icon="link" label="연결된 계정" onClick={() => setSub('connected')} />
        <LinkRow icon="info" label="내 정보 및 권한" onClick={() => setSub('data')} />
      </Group>
      <Group>
        <LinkRow icon="logout" label="로그아웃" onClick={notReady} />
        <LinkRow icon="leave" label="회원 탈퇴" onClick={notReady} danger />
      </Group>
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

// ── 프로필 편집 ──
export function ProfilePanel({ profile, pet, onSave, notReady }) {
  const [draft, setDraft] = useState(profile)
  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }))

  return (
    <>
      <PanelTitle title="프로필 편집" />
      <ProfileBar
        profile={profile}
        pet={pet}
        action={<button type="button" className="dp-btn dp-btn--accent" onClick={notReady}>아이콘 변경</button>}
      />
      <label className="mp-field">
        <span className="mp-field__label">이름</span>
        <input className="dy-input mp-input" value={draft.nickname} onChange={set('nickname')} maxLength={20} />
      </label>
      <label className="mp-field">
        <span className="mp-field__label">소속 대학</span>
        <input className="dy-input mp-input" value={draft.university} onChange={set('university')} maxLength={30} />
      </label>
      <div className="mp-field-row">
        <label className="mp-field">
          <span className="mp-field__label">학년</span>
          <select className="dy-input mp-input" value={draft.grade} onChange={set('grade')}>
            {[1, 2, 3, 4].map((g) => <option key={g} value={g}>{g}학년</option>)}
          </select>
        </label>
        <label className="mp-field">
          <span className="mp-field__label">학기</span>
          <select className="dy-input mp-input" value={draft.semester} onChange={set('semester')}>
            {[1, 2].map((s) => <option key={s} value={s}>{s}학기</option>)}
          </select>
        </label>
      </div>
      <label className="mp-field">
        <span className="mp-field__label">희망 직무</span>
        <input className="dy-input mp-input" value={draft.desiredJob} onChange={set('desiredJob')} maxLength={30} />
      </label>
      <label className="mp-field">
        <span className="mp-field__label">소개</span>
        <textarea
          className="dy-input mp-input mp-textarea"
          value={draft.bio}
          onChange={set('bio')}
          maxLength={150}
          placeholder="나를 한 줄로 소개해 보세요."
        />
      </label>
      <div className="dp-actions">
        <button
          type="button"
          className="dp-btn dp-btn--accent"
          onClick={() => onSave({ ...draft, grade: Number(draft.grade), semester: Number(draft.semester) })}
        >
          저장
        </button>
      </div>
    </>
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
          <Link key={d.date} to={`/diary?date=${d.date}`} className="mp-row mp-row--link mp-recent">
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
        <LinkRow icon="activity" label="일기장 열기" to="/diary" />
        <LinkRow icon="archive" label="로드맵 보관함" hint="삭제한 학기의 노드·문서" onClick={notReady} />
        <LinkRow icon="info" label="내 기록 내보내기" hint="일기·로드맵을 파일로 저장" onClick={notReady} />
      </Group>
    </>
  )
}

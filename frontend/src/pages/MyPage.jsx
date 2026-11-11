import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import RoadmapNav from '../features/roadmap/RoadmapNav.jsx'
import { getPet } from '../features/pet/petMock.js'
import { mockProfile, mockSettings } from '../features/mypage/myPageMock.js'
import { Icon } from '../features/mypage/ui.jsx'
import {
  AccountPanel, ActivityPanel, DisplayPanel, NoticePanel, ProfilePanel, RecordsPanel,
} from '../features/mypage/panels.jsx'
// 로드맵과 같은 디자인 (rm-* 스타일은 수정하지 않고 사용만)
import '../features/roadmap/roadmap.css'
import '../features/diary/DiaryEditor.css' // 페이지 틀·색 변수(.diary-page)
import '../features/diary/DiaryHome.css' // 버튼(dp-btn)
import '../features/mypage/MyPage.css'

// 왼쪽 메뉴 (묶음 → 항목). keywords는 검색용
const MENU_GROUPS = [
  {
    title: '내 계정',
    items: [
      { key: 'account', icon: 'account', label: '계정 센터', desc: '프로필, 연결된 계정, 내 정보, 로그아웃', keywords: '로그인 로그아웃 탈퇴 구글 닉네임 학년' },
    ],
  },
  {
    title: '나의 사용 방식',
    items: [
      { key: 'profile', icon: 'profile', label: '프로필 편집', keywords: '닉네임 이름 학년 직무 희망 아이콘' },
      { key: 'notice', icon: 'bell', label: '알림', keywords: '일기 출석 회고 시간' },
      { key: 'display', icon: 'display', label: '화면 설정', keywords: '시작 화면 요일 애니메이션 움직임' },
    ],
  },
  {
    title: '나의 기록',
    items: [
      { key: 'activity', icon: 'activity', label: '내 활동', keywords: '일기 펫 에너지 최근' },
      { key: 'records', icon: 'archive', label: '기록 관리', keywords: '보관함 내보내기 일기장' },
    ],
  },
]

// 마이페이지 (/mypage) — [미확정] SPEC에 없는 화면. 지금은 Mock 데이터로 화면만 만든다.
// 왼쪽 메뉴에서 고르면 오른쪽에 그 내용이 보인다.
export default function MyPage() {
  // 처음 보여 줄 메뉴: 일기장에서 돌아온 경우 ?tab= 의 메뉴, 아니면 계정 센터
  const [searchParams] = useSearchParams()
  const [selected, setSelected] = useState(() => {
    const tab = searchParams.get('tab')
    return MENU_GROUPS.some((g) => g.items.some((it) => it.key === tab)) ? tab : 'account'
  })
  const [query, setQuery] = useState('')
  const [profile, setProfile] = useState(mockProfile)
  const [settings, setSettings] = useState(mockSettings)
  const [toast, setToast] = useState('')
  const pet = getPet()

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(timer)
  }, [toast])

  // 설정 한 개 바꾸기 (지금은 화면에서만 바뀌고 저장되지 않음)
  const update = (key, value) => setSettings((s) => ({ ...s, [key]: value }))
  const notReady = () => setToast('준비 중인 기능이에요.')
  // choices: 희망 직무를 바꿨을 때만 { resetCourses, resetPet }
  // ※ 과목 재설정·펫 재시작은 실제로는 서버 RPC로 처리해야 한다. (지금은 Mock: 안내만)
  function saveProfile(next, choices) {
    setProfile(next)
    if (!choices) {
      setToast('프로필을 저장했어요.')
      return
    }
    const parts = ['희망 직무를 바꿨어요.']
    if (choices.resetCourses) parts.push('이후 과목을 다시 짤게요.')
    if (choices.resetPet) parts.push('펫을 새로 시작해요.')
    setToast(parts.join(' '))
  }

  // 검색어가 이름·설명·키워드에 들어 있는 항목만
  const q = query.trim()
  const groups = MENU_GROUPS
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => !q || `${it.label} ${it.desc || ''} ${it.keywords}`.includes(q)),
    }))
    .filter((g) => g.items.length > 0)

  const panelProps = { profile, pet, settings, update, notReady }

  return (
    <div className="diary-page">
      <RoadmapNav />
      <main className="mp-layout">
        {/* ── 왼쪽 메뉴 ── */}
        <aside className="mp-side">
          <h1 className="mp-side__title">MY PAGE</h1>
          <label className="mp-search">
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder="검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="설정 검색"
            />
          </label>

          <nav aria-label="마이페이지 메뉴">
            {groups.length === 0 && <p className="rm-muted mp-side__empty">검색 결과가 없어요.</p>}
            {groups.map((g) => (
              <div key={g.title} className="mp-side__group">
                <p className="mp-side__group-title">{g.title}</p>
                {g.items.map((it) => (
                  <button
                    key={it.key}
                    type="button"
                    className={`mp-side__item ${selected === it.key ? 'is-active' : ''}`}
                    aria-current={selected === it.key ? 'page' : undefined}
                    onClick={() => setSelected(it.key)}
                  >
                    <span className="mp-side__dot" aria-hidden="true" />
                    <Icon name={it.icon} />
                    <span>
                      <span className="mp-side__label">{it.label}</span>
                      {it.desc && <span className="mp-side__desc">{it.desc}</span>}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        {/* ── 오른쪽 내용 (key: 메뉴를 바꾸면 하위 화면·입력 상태를 처음으로) ── */}
        <section className="mp-panel" key={selected}>
          {selected === 'account' && <AccountPanel {...panelProps} />}
          {selected === 'profile' && <ProfilePanel {...panelProps} onSave={saveProfile} />}
          {selected === 'notice' && <NoticePanel {...panelProps} />}
          {selected === 'display' && <DisplayPanel {...panelProps} />}
          {selected === 'activity' && <ActivityPanel {...panelProps} />}
          {selected === 'records' && <RecordsPanel {...panelProps} />}
        </section>
      </main>

      <div className={`rm-toast dy-toast ${toast ? 'is-visible' : ''}`} role="status">{toast}</div>
    </div>
  )
}

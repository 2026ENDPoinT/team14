// 사진을 가져올 곳 목록 (아이콘 선 모양)
const SOURCES = [
  { label: '사진 보관함', icon: <><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="M20.5 16l-5-5-8 8.5" /></> },
  { label: '파일 선택', icon: <path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4.5l2 2H19a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" /> },
]

// 사진 추가 안내 팝업 (화면만 있음)
// 사진 첨부는 단계적 적용(SPEC 7장)이라 아직 실제로 사진을 고르거나 올리지 않는다.
export default function PhotoModal({ onClose }) {
  return (
    <div className="dp-modal dp-modal--photo" role="dialog" aria-modal="true" aria-label="사진 추가">
      <div className="dp-modal__backdrop" onClick={onClose} />
      <section className="dp-photo">
        <h3 className="dp-photo__title">오늘의 장면을 담아보세요</h3>
        <p className="rm-muted dp-photo__sub">일기와 함께 사진을 최대 5장 남길 수 있어요.</p>

        {/* 아직 동작하지 않는 버튼들 (사진 업로드 연결 전) */}
        <ul className="dp-photo__list">
          {SOURCES.map((s) => (
            <li key={s.label}>
              <button type="button" className="dp-photo__pick" aria-disabled="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {s.icon}
                </svg>
                {s.label}
              </button>
            </li>
          ))}
        </ul>
        <p className="rm-muted dp-photo__note">디자인 미리보기에서는 기기 사진에 접근하지 않아요.</p>

        <button type="button" className="dp-btn dp-btn--accent dp-btn--wide" onClick={onClose}>
          닫기
        </button>
      </section>
    </div>
  )
}

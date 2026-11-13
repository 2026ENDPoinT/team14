import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PHOTO_MAX_COUNT } from '../../services/photos.js'
import './photos.css'

// 사진 첨부 칸 (로드맵 활동 상세 · 일기 공용). 상태는 usePhotoDraft가 가진다.
// props
//   draft: usePhotoDraft() 결과 / readOnly: 보기만 (추가·삭제 버튼 없음)
//   disabledNote: 사진을 쓸 수 없을 때 안내 (예: 로그인 전) / onChange: 사진을 추가·삭제했을 때
export default function PhotoField({ draft, readOnly = false, disabledNote = '', onChange }) {
  const inputRef = useRef(null)
  const [notice, setNotice] = useState('')
  const [viewing, setViewing] = useState(null) // 크게 보는 사진 주소

  if (disabledNote) return <p className="ph-note">{disabledNote}</p>

  const pick = (e) => {
    const message = draft.addFiles(e.target.files)
    e.target.value = '' // 같은 파일을 다시 고를 수 있게
    setNotice(message)
    onChange?.()
  }
  const full = draft.items.length >= PHOTO_MAX_COUNT

  return (
    <div className="ph">
      {draft.loading && <p className="ph-note">사진을 불러오는 중…</p>}
      {draft.loadError && <p className="ph-note is-error" role="alert">{draft.loadError}</p>}
      {readOnly && !draft.loading && draft.items.length === 0 && <p className="ph-note">사진이 없어요.</p>}

      {(draft.items.length > 0 || !readOnly) && (
        <ul className="ph-list">
          {draft.items.map((p) => (
            <li key={p.key} className={`ph-item is-${p.status} ${p.kind === 'new' ? 'is-new' : ''}`}>
              <button type="button" className="ph-thumb" onClick={() => p.url && setViewing(p.url)} aria-label="사진 크게 보기">
                {p.url ? <img src={p.url} alt="" /> : <span className="ph-missing">불러오지 못함</span>}
              </button>
              {p.status === 'uploading' && <span className="ph-badge">올리는 중</span>}
              {p.status === 'failed' && <span className="ph-badge is-error" title={p.error}>실패</span>}
              {p.status === 'ok' && p.kind === 'new' && <span className="ph-badge is-new">저장 전</span>}
              {!readOnly && p.status !== 'uploading' && (
                <button
                  type="button"
                  className="ph-remove"
                  aria-label="사진 삭제"
                  onClick={() => { draft.remove(p.key); setNotice(''); onChange?.() }}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
          {!readOnly && !full && !draft.loading && (
            <li>
              <button type="button" className="ph-add" onClick={() => inputRef.current?.click()}>
                <span aria-hidden="true">+</span>
                사진 추가
              </button>
            </li>
          )}
        </ul>
      )}

      {!readOnly && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            hidden
            onChange={pick}
            aria-label="사진 파일 선택"
          />
          <p className="ph-note">
            jpg·png·webp·gif, 한 장 5MB까지 최대 {PHOTO_MAX_COUNT}장. 저장 버튼을 눌러야 올라가요.
          </p>
        </>
      )}
      {notice && <p className="ph-note is-error" role="alert">{notice}</p>}

      {/* 크게 보기: 팝업 애니메이션 영향을 받지 않게 body에 그린다 */}
      {viewing && createPortal(
        <div className="ph-viewer" role="dialog" aria-label="사진 크게 보기" onClick={() => setViewing(null)}>
          <img src={viewing} alt="" />
        </div>,
        document.body,
      )}
    </div>
  )
}

import { useRef, useState } from 'react'
import { FILE_ACCEPT, FILE_MAX_COUNT, LINK_MAX_COUNT, fileDownloadUrl } from '../../services/attachments.js'
import './attachments.css'

const sizeText = (bytes) => (bytes == null ? '' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`)

// 활동 상세의 링크·파일 첨부 칸. 상태는 useAttachmentDraft가 가진다.
// - 링크: 새 탭으로 열기 / 파일: 누르면 그때 서명 URL을 받아 내려받기
// props: draft, onChange(추가·삭제했을 때)
export default function AttachmentField({ draft, onChange }) {
  const fileRef = useRef(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [notice, setNotice] = useState('')
  const [opening, setOpening] = useState(null)

  const submitLink = () => {
    const message = draft.addLink({ url, name })
    setNotice(message)
    if (message) return
    setUrl('')
    setName('')
    setLinkOpen(false)
    onChange?.()
  }

  const pickFiles = (e) => {
    setNotice(draft.addFiles(e.target.files))
    e.target.value = ''
    onChange?.()
  }

  // 저장된 파일 열기: 1분짜리 서명 URL로 내려받기 (주소는 저장하지 않음)
  const openFile = async (item) => {
    setOpening(item.key)
    const result = await fileDownloadUrl(item)
    setOpening(null)
    if (result.error) return setNotice(result.error.message)
    const a = document.createElement('a')
    a.href = result.data
    a.rel = 'noopener'
    a.click()
  }

  return (
    <div className="at">
      {draft.loading && <p className="at-note">첨부를 불러오는 중…</p>}
      {draft.loadError && <p className="at-note is-error" role="alert">{draft.loadError}</p>}

      {draft.items.length > 0 && (
        <ul className="at-list">
          {draft.items.map((item) => (
            <li key={item.key} className={`at-item is-${item.status}`} data-kind={item.kind}>
              <span className="at-icon" aria-hidden="true">{item.kind === 'link' ? '🔗' : '📎'}</span>
              {item.kind === 'link' ? (
                <a className="at-name" href={item.url} target="_blank" rel="noopener noreferrer" title={item.url}>{item.name}</a>
              ) : item.saved ? (
                <button type="button" className="at-name at-name--btn" onClick={() => openFile(item)} disabled={opening === item.key} title="내려받기">
                  {item.name}
                </button>
              ) : (
                <span className="at-name">{item.name}</span>
              )}
              {item.kind === 'file' && <span className="at-size">{sizeText(item.size)}</span>}
              {!item.saved && item.status === 'ok' && <span className="at-badge">저장 전</span>}
              {item.status === 'uploading' && <span className="at-badge">저장 중</span>}
              {item.status === 'failed' && <span className="at-badge is-error" title={item.error}>실패</span>}
              {item.status !== 'uploading' && (
                <button type="button" className="at-remove" aria-label={`${item.name} 첨부 삭제`} onClick={() => { draft.remove(item.key); setNotice(''); onChange?.() }}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {linkOpen && (
        <div className="at-link-form">
          <input
            className="rm-input"
            placeholder="https://"
            value={url}
            aria-label="링크 주소"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), submitLink())}
            autoFocus
          />
          <input
            className="rm-input"
            placeholder="표시할 이름 (선택)"
            value={name}
            maxLength={200}
            aria-label="링크 이름"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), submitLink())}
          />
          <div className="at-link-actions">
            <button type="button" className="rm-chip is-selected" onClick={submitLink} disabled={!url.trim()}>추가</button>
            <button type="button" className="rm-chip" onClick={() => { setLinkOpen(false); setNotice('') }}>취소</button>
          </div>
        </div>
      )}

      <div className="at-actions">
        <button type="button" className="at-add" onClick={() => { setLinkOpen(true); setNotice('') }} disabled={linkOpen || draft.loading}>
          🔗 링크 추가
        </button>
        <button type="button" className="at-add" onClick={() => fileRef.current?.click()} disabled={draft.loading}>
          📎 파일 첨부
        </button>
        <input ref={fileRef} type="file" accept={FILE_ACCEPT} multiple hidden onChange={pickFiles} aria-label="첨부 파일 선택" />
      </div>
      <p className="at-note">
        링크는 http·https 주소 {LINK_MAX_COUNT}개까지, 파일은 문서·이미지·zip 한 개 5MB까지 {FILE_MAX_COUNT}개. 저장 버튼을 눌러야 저장돼요.
      </p>
      {notice && <p className="at-note is-error" role="alert">{notice}</p>}
    </div>
  )
}

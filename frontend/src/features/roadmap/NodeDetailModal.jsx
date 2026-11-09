import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { ClipIcon, CloseIcon, SaveIcon, TrashIcon } from './icons.jsx'

// 노드 상세 창. 노드를 클릭했을 때만 열린다.
// node가 null이 되어도 닫힘 애니메이션 동안 마지막 노드를 보여 준다.
export default function NodeDetailModal({ node, body, connections, onClose, onSave, onDelete, onOpenNode }) {
  const [shown, setShown] = useState(node)
  const [title, setTitle] = useState('')
  const [record, setRecord] = useState('')
  const [saved, setSaved] = useState(false)

  // 다른 노드를 열 때만 입력값을 새로 채운다 (저장 후에는 그대로 유지)
  useEffect(() => {
    if (!node) return
    setShown(node)
    setTitle(node.title)
    setRecord(body)
    setSaved(false)
  }, [node?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    if (!title.trim()) return
    onSave(shown.id, { title: title.trim(), body: record })
    setSaved(true)
  }

  const handleDelete = () => {
    if (window.confirm(`'${title || shown.title}' 노드를 삭제할까요? 문서도 함께 삭제됩니다.`)) {
      onDelete(shown.id)
    }
  }

  return (
    <Modal open={Boolean(node)} onClose={onClose} label="노드 상세">
      {shown && (
        <div className="rm-form">
          <header className="rm-modal__head">
            <p className="rm-eyebrow">NODE DETAILS</p>
            <div className="rm-modal__actions">
              {saved && <span className="rm-saved">저장됨</span>}
              <button type="button" className="rm-icon-btn" aria-label="저장" onClick={handleSave}>
                <SaveIcon />
              </button>
              <button type="button" className="rm-icon-btn" aria-label="삭제" onClick={handleDelete}>
                <TrashIcon />
              </button>
              <button type="button" className="rm-icon-btn" aria-label="닫기" onClick={onClose}>
                <CloseIcon />
              </button>
            </div>
          </header>

          <input
            className="rm-detail-title"
            value={title}
            aria-label="노드 이름"
            onChange={(e) => { setTitle(e.target.value); setSaved(false) }}
          />

          <label className="rm-field">
            <span className="rm-eyebrow">MY RECORD</span>
            <textarea
              className="rm-input rm-textarea rm-textarea--tall"
              placeholder="활동하면서 배운 점, 링크, 회의 기록 등을 적어 보세요"
              value={record}
              onChange={(e) => { setRecord(e.target.value); setSaved(false) }}
            />
          </label>

          {/* 첨부 기능은 P1 (SPEC 6.5 [미확정]) — 화면만 표시 */}
          <div className="rm-field">
            <span className="rm-eyebrow">ATTACHMENTS</span>
            <div className="rm-input rm-attach" aria-disabled="true">
              <ClipIcon width="18" height="18" /> 파일 · 이미지 · 링크 추가 (준비 중)
            </div>
          </div>

          <div className="rm-field">
            <span className="rm-eyebrow">CONNECTIONS</span>
            <div className="rm-chips">
              {connections.length === 0 && <span className="rm-muted">연결된 노드가 없어요.</span>}
              {connections.map((c) => (
                <button key={c.id} type="button" className="rm-chip" onClick={() => onOpenNode(c.id)}>
                  {c.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

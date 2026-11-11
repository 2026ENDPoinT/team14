import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { CloseIcon, PlusIcon } from './icons.jsx'
import { BASE_CATEGORIES, sameName } from './nodeCategories.js'

const INBOX = 'inbox'
const DEFAULT_CATEGORY = 'project'
const CATEGORY_NAME_MAX = 12

// 노드 생성 창. + 메뉴의 NODE 또는 보관함의 + 버튼을 눌렀을 때만 열린다.
// NODE TYPE: 카테고리 칩 (온보딩 경험 대분류 + 전공·학업·자유 + 직접 추가한 종류)
// DETAIL TYPE: 고른 카테고리의 세부 활동 (선택). 고르면 NODE NAME이 자동으로 채워진다.
// 저장되는 종류 값(theme)은 기존 7개 중 하나 (nodeCategories.js)
export default function AddNodeModal({ open, periods, onClose, onCreate }) {
  const [categoryId, setCategoryId] = useState(DEFAULT_CATEGORY)
  const [detailId, setDetailId] = useState(null)
  const [title, setTitle] = useState('')
  const [autoTitle, setAutoTitle] = useState('') // 세부 활동으로 자동 입력한 제목 (사용자가 고치지 않았는지 확인용)
  const [destination, setDestination] = useState(INBOX)
  const [memo, setMemo] = useState('')
  // 직접 추가한 종류: 아직 서버에 저장할 곳이 없어 이 화면(새로고침 전까지)에서만 유지한다
  const [customCategories, setCustomCategories] = useState([])
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [nameError, setNameError] = useState('')

  const categories = [...BASE_CATEGORIES, ...customCategories]
  const category = categories.find((c) => c.id === categoryId) ?? categories[0]
  const detail = category.details.find((d) => d.id === detailId) ?? null
  const theme = detail?.theme ?? category.theme

  // 열 때마다 입력값 초기화 (직접 추가한 종류 목록은 유지)
  useEffect(() => {
    if (open) {
      setCategoryId(DEFAULT_CATEGORY)
      setDetailId(null)
      setTitle('')
      setAutoTitle('')
      setDestination(INBOX)
      setMemo('')
      setAdding(false)
      setNewName('')
      setNameError('')
    }
  }, [open])

  // 자동 입력된 제목을 사용자가 고치지 않았으면 비운다 (직접 입력한 제목은 그대로)
  const clearAutoTitle = () => {
    if (autoTitle && title === autoTitle) setTitle('')
    setAutoTitle('')
  }

  // 카테고리 변경: 이전 세부 활동 선택은 해제
  const selectCategory = (id) => {
    if (id === categoryId) return
    setCategoryId(id)
    setDetailId(null)
    clearAutoTitle()
  }

  // 세부 활동: 하나만, 다시 누르면 해제. 고르면 NODE NAME 자동 입력
  const selectDetail = (item) => {
    if (item.id === detailId) {
      setDetailId(null)
      clearAutoTitle()
      return
    }
    setDetailId(item.id)
    setTitle(item.title)
    setAutoTitle(item.title)
  }

  const addCategory = () => {
    const name = newName.trim()
    if (!name) return setNameError('종류 이름을 입력해 주세요.')
    if (categories.some((c) => sameName(c.label, name))) return setNameError('이미 있는 종류예요.')
    const id = `custom_${Date.now()}`
    // 저장 값은 자유 노드(free). 종류 이름을 따로 저장할 DB 구조가 아직 없다.
    setCustomCategories((prev) => [...prev, { id, label: name, theme: 'free', details: [], custom: true }])
    setAdding(false)
    setNewName('')
    setNameError('')
    selectCategory(id)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onCreate({
      theme,
      title: title.trim(),
      periodId: destination === INBOX ? null : destination,
      memo: memo.trim(),
    })
  }

  return (
    <Modal open={open} onClose={onClose} label="노드 추가">
      <form className="rm-form" onSubmit={handleSubmit}>
        <header className="rm-modal__head">
          <div>
            <p className="rm-eyebrow">CREATE NEW</p>
            <h2 className="rm-modal__title">ADD NODE</h2>
          </div>
          <button type="button" className="rm-icon-btn" aria-label="닫기" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <hr className="rm-divider" />

        <div className="rm-field">
          <span className="rm-eyebrow" id="add-node-type">NODE TYPE</span>
          <div className="rm-chips" role="radiogroup" aria-labelledby="add-node-type">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={c.id === categoryId}
                className={`rm-chip ${c.id === categoryId ? 'is-selected' : ''}`}
                onClick={() => selectCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
            {!adding && (
              <button type="button" className="rm-chip rm-chip--add" onClick={() => setAdding(true)}>
                <PlusIcon width="12" height="12" strokeWidth="2.4" />
                종류 추가
              </button>
            )}
          </div>
          {adding && (
            <div className="rm-chip-add">
              <input
                className="rm-input"
                placeholder="새 종류 이름"
                aria-label="새 종류 이름"
                maxLength={CATEGORY_NAME_MAX}
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value)
                  setNameError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault() // 노드 생성 폼이 제출되지 않게
                    addCategory()
                  }
                  if (e.key === 'Escape') {
                    e.stopPropagation()
                    setAdding(false)
                  }
                }}
                autoFocus
              />
              <button type="button" className="rm-chip is-selected" onClick={addCategory}>추가</button>
              <button type="button" className="rm-chip" onClick={() => { setAdding(false); setNewName(''); setNameError('') }}>취소</button>
            </div>
          )}
          {nameError && <p className="rm-field-note is-error" role="alert">{nameError}</p>}
          {category.custom && (
            <p className="rm-field-note">
              직접 추가한 종류는 아직 서버에 저장되지 않아요. 노드는 ‘자유 노드’로 만들어지고, 새로고침하면 이 종류는 목록에서 사라져요.
            </p>
          )}
        </div>

        <div className="rm-field">
          <span className="rm-eyebrow" id="add-node-detail">DETAIL TYPE (OPTIONAL)</span>
          {category.details.length > 0 ? (
            <div className="rm-chips" role="radiogroup" aria-labelledby="add-node-detail">
              {category.details.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={item.id === detailId}
                  className={`rm-chip ${item.id === detailId ? 'is-selected' : ''}`}
                  onClick={() => selectDetail(item)}
                >
                  {item.title}
                </button>
              ))}
            </div>
          ) : (
            <p className="rm-field-note">세부 활동이 없는 종류예요. 노드 이름을 직접 입력해 주세요.</p>
          )}
        </div>

        <label className="rm-field">
          <span className="rm-eyebrow">NODE NAME</span>
          <input
            className="rm-input"
            placeholder="노드 이름을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </label>

        <label className="rm-field">
          <span className="rm-eyebrow">DESTINATION</span>
          <select
            className="rm-input rm-select"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          >
            <option value={INBOX}>INBOX (나중에 배치)</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        <label className="rm-field">
          <span className="rm-eyebrow">SHORT NOTE</span>
          <textarea
            className="rm-input rm-textarea"
            placeholder="간단한 메모 (선택)"
            rows={3}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </label>

        <button type="submit" className="rm-primary-btn" disabled={!title.trim()}>
          CREATE NODE
        </button>
      </form>
    </Modal>
  )
}

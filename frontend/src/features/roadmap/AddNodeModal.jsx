import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { CloseIcon } from './icons.jsx'
import { BASE_CATEGORIES } from './nodeCategories.js'
import CategoryPicker from './CategoryPicker.jsx'

const INBOX = 'inbox'
const DEFAULT_CATEGORY = 'project'

// 노드 생성 창. + 메뉴의 NODE 또는 보관함의 + 버튼을 눌렀을 때만 열린다.
// NODE TYPE: 카테고리 칩 (온보딩 경험 대분류 + 전공·학업·자유 + 직접 추가한 종류)
// DETAIL TYPE: 고른 카테고리의 세부 활동 (선택). 고르면 NODE NAME이 자동으로 채워진다.
// 저장되는 종류 값(theme)은 기존 7개 중 하나 (nodeCategories.js)
// customCategories·onAddCustomCategory: 직접 추가한 종류 (NODE DETAILS와 함께 쓰려고 페이지에서 관리)
export default function AddNodeModal({ open, periods, onClose, onCreate, customCategories, onAddCustomCategory }) {
  const [categoryId, setCategoryId] = useState(DEFAULT_CATEGORY)
  const [detailId, setDetailId] = useState(null)
  const [title, setTitle] = useState('')
  const [autoTitle, setAutoTitle] = useState('') // 세부 활동으로 자동 입력한 제목 (사용자가 고치지 않았는지 확인용)
  const [destination, setDestination] = useState(INBOX)
  const [memo, setMemo] = useState('')

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

  // 종류 추가 (이름 검사는 CategoryPicker): 추가하고 바로 선택
  const addCategory = (name) => {
    selectCategory(onAddCustomCategory(name))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onCreate({
      theme,
      title: title.trim(),
      periodId: destination === INBOX ? null : destination,
      memo: memo.trim(),
      // 고른 카테고리·세부 활동 (NODE DETAILS와 같은 세션 전용 값. 아직 DB에는 theme만 저장할 수 있다)
      categoryId: category.id,
      detailId: detail?.id ?? null,
      categoryLabel: category.label,
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

        <CategoryPicker
          idPrefix="add-node"
          categories={categories}
          categoryId={categoryId}
          detailId={detailId}
          onSelectCategory={selectCategory}
          onSelectDetail={selectDetail}
          onAddCategory={addCategory}
          resetKey={open}
          customNote="직접 추가한 종류는 아직 서버에 저장되지 않아요. 내부 분류는 ‘자유 노드’로 정해지고, 새로고침하면 이 종류는 목록에서 사라져요."
        />

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

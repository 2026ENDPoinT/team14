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
  const [courseKey, setCourseKey] = useState(null) // 전공·학업에서 고른 교과목 키 (교과과정 데이터 key)
  const [title, setTitle] = useState('')
  const [autoTitle, setAutoTitle] = useState('') // 세부 활동으로 자동 입력한 제목 (사용자가 고치지 않았는지 확인용)
  const [destination, setDestination] = useState(INBOX)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false) // 서버에 저장하는 중 (연속 클릭 방지)
  const [saveError, setSaveError] = useState('')

  const categories = [...BASE_CATEGORIES, ...customCategories]
  const category = categories.find((c) => c.id === categoryId) ?? categories[0]
  const detail = category.details.find((d) => d.id === detailId) ?? null
  const theme = detail?.theme ?? category.theme

  // 열 때마다 입력값 초기화 (직접 추가한 종류 목록은 유지)
  useEffect(() => {
    if (open) {
      setCategoryId(DEFAULT_CATEGORY)
      setDetailId(null)
      setCourseKey(null)
      setTitle('')
      setAutoTitle('')
      setDestination(INBOX)
      setMemo('')
      setSaving(false)
      setSaveError('')
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
    setCourseKey(null)
    clearAutoTitle()
  }

  // 교과목: 하나만, 다시 누르면 해제. 고르면 NODE NAME에 과목명 자동 입력 (세부 활동과 같은 규칙)
  const selectCourse = (course) => {
    if (course.key === courseKey) {
      setCourseKey(null)
      clearAutoTitle()
      return
    }
    setCourseKey(course.key)
    setTitle(course.title)
    setAutoTitle(course.title)
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

  // 종류 추가 (이름 검사는 CategoryPicker): 서버에 저장되면 바로 선택. 실패하면 오류 문구를 돌려준다
  const addCategory = async (name) => {
    const result = await onAddCustomCategory(name)
    if (result.error) return result.error
    selectCategory(result.id)
    return null
  }

  // onCreate는 저장 결과를 돌려준다: 성공 null / 실패 오류 문구 (실패하면 창을 닫지 않고 입력값을 유지)
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    setSaveError('')
    const error = await onCreate({
      theme,
      title: title.trim(),
      periodId: destination === INBOX ? null : destination,
      memo: memo.trim(),
      // 고른 카테고리·세부 활동 (로그인 상태면 노드와 함께 DB에 저장된다)
      categoryId: category.id,
      detailId: detail?.id ?? null,
      categoryLabel: category.label,
      courseKey: category.id === 'major' ? courseKey : null, // 연결한 교과목 (세션 전용)
    })
    setSaving(false)
    if (error) setSaveError(error)
  }

  return (
    <Modal open={open} onClose={onClose} label="활동 추가">
      <form className="rm-form" onSubmit={handleSubmit}>
        <header className="rm-modal__head">
          <div>
            <p className="rm-eyebrow">새로 만들기</p>
            <h2 className="rm-modal__title">활동 추가</h2>
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
          courseKey={courseKey}
          onSelectCourse={selectCourse}
          customNote="직접 추가한 종류는 내 계정에 저장돼요. 내부 분류는 ‘자유 활동’으로 정해져요."
        />

        <label className="rm-field">
          <span className="rm-eyebrow">이름</span>
          <input
            className="rm-input"
            placeholder="활동 이름을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </label>

        <label className="rm-field">
          <span className="rm-eyebrow">놓을 곳</span>
          <select
            className="rm-input rm-select"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          >
            <option value={INBOX}>보관함 (나중에 배치)</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        <label className="rm-field">
          <span className="rm-eyebrow">짧은 메모</span>
          <textarea
            className="rm-input rm-textarea"
            placeholder="간단한 메모 (선택)"
            rows={3}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </label>

        {saveError && <p className="rm-field-note is-error" role="alert">{saveError}</p>}
        <button type="submit" className="rm-primary-btn" disabled={!title.trim() || saving}>
          {saving ? 'SAVING…' : '추가하기'}
        </button>
      </form>
    </Modal>
  )
}

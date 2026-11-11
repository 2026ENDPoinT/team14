import { useEffect, useState } from 'react'
import { PlusIcon } from './icons.jsx'
import { courseOptions, sameName } from './nodeCategories.js'

const CATEGORY_NAME_MAX = 12

// NODE TYPE(카테고리 칩 + 종류 추가) · DETAIL TYPE(세부 활동 칩) 선택 영역
// ADD NODE와 NODE DETAILS가 함께 쓴다. 선택값은 부모가 관리한다.
// - idPrefix: 화면마다 다른 aria id ('add-node' → add-node-type / add-node-detail)
// - onSelectDetail(item): 세부 활동을 누를 때 (다시 누르면 해제는 부모가 판단)
// - onAddCategory(name): 이름 검사(빈 값·중복)를 통과한 새 종류 이름. 서버에 저장한 뒤
//   실패하면 오류 문구(string), 성공하면 null을 돌려준다 (Promise). 성공했을 때만 입력칸을 닫는다.
// - customNote: 직접 추가한 종류를 골랐을 때 보여 줄 안내
// - 전공·학업(major)을 고르면 DETAIL TYPE 대신 COURSE (OPTIONAL): 교과과정 과목 칩 (하나만, 다시 누르면 해제)
//   courseKey·onSelectCourse(course) / courseLocked: 온보딩 교과목 노드처럼 과목을 바꿀 수 없을 때
// - emptyDetailNote: 세부 활동이 없는 종류일 때 안내
// - resetKey: 바뀌면 종류 추가 입력칸을 닫는다 (모달을 다시 열 때)
// display: contents 래퍼(.rm-pick)라서 두 영역이 폼의 다른 영역과 같은 간격으로 놓인다.
export default function CategoryPicker({
  idPrefix, categories, categoryId, detailId, onSelectCategory, onSelectDetail, onAddCategory, customNote, resetKey,
  courseKey = null, onSelectCourse, courseLocked = false,
  emptyDetailNote = '세부 활동이 없는 종류예요. 활동 이름을 직접 입력해 주세요.',
}) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [nameError, setNameError] = useState('')
  const [saving, setSaving] = useState(false) // 서버에 저장하는 중 (연속 클릭 방지)

  useEffect(() => {
    setAdding(false)
    setNewName('')
    setNameError('')
  }, [resetKey])

  const category = categories.find((c) => c.id === categoryId) ?? categories[0]
  const courses = category.id === 'major' ? courseOptions() : []

  const closeAdd = () => {
    setAdding(false)
    setNewName('')
    setNameError('')
  }

  const addCategory = async () => {
    if (saving) return
    const name = newName.trim()
    if (!name) return setNameError('종류 이름을 입력해 주세요.')
    if (categories.some((c) => sameName(c.label, name))) return setNameError('이미 있는 종류예요.')
    setSaving(true)
    const error = await onAddCategory(name)
    setSaving(false)
    if (error) return setNameError(error) // 저장 실패: 입력한 이름은 그대로 두고 오류만 보여 준다
    closeAdd()
  }

  return (
    <div className="rm-pick">
      <div className="rm-field">
        <span className="rm-eyebrow" id={`${idPrefix}-type`}>종류</span>
        <div className="rm-chips" role="radiogroup" aria-labelledby={`${idPrefix}-type`}>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={c.id === categoryId}
              className={`rm-chip ${c.id === categoryId ? 'is-selected' : ''}`}
              onClick={() => onSelectCategory(c.id)}
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
                  e.stopPropagation() // 모달 전체가 닫히지 않게
                  closeAdd() // 입력하던 이름도 비운다
                }
              }}
              autoFocus
            />
            <button type="button" className="rm-chip is-selected" onClick={addCategory} disabled={saving}>
              {saving ? '저장 중…' : '추가'}
            </button>
            <button type="button" className="rm-chip" onClick={closeAdd}>취소</button>
          </div>
        )}
        {nameError && <p className="rm-field-note is-error" role="alert">{nameError}</p>}
        {category.custom && customNote && <p className="rm-field-note">{customNote}</p>}
      </div>

      {category.id === 'major' ? (
      <div className="rm-field">
        <span className="rm-eyebrow" id={`${idPrefix}-course`}>교과목 (선택)</span>
        {courses.length > 0 ? (
          <div className="rm-chips" role="radiogroup" aria-labelledby={`${idPrefix}-course`}>
            {courses.map((course) => (
              <button
                key={course.key}
                type="button"
                role="radio"
                aria-checked={course.key === courseKey}
                className={`rm-chip ${course.key === courseKey ? 'is-selected' : ''}`}
                onClick={() => onSelectCourse(course)}
                disabled={courseLocked}
              >
                {course.title}
              </button>
            ))}
          </div>
        ) : (
          <p className="rm-field-note">교과과정 데이터가 연결되면 여기에서 과목을 고를 수 있어요. 지금은 과목 없이 전공·학업 활동으로 만들 수 있어요.</p>
        )}
        {courseLocked && courses.length > 0 && (
          <p className="rm-field-note">온보딩에서 만든 교과목 활동은 연결된 과목을 바꿀 수 없어요.</p>
        )}
      </div>
      ) : (
      <div className="rm-field">
        <span className="rm-eyebrow" id={`${idPrefix}-detail`}>세부 활동 (선택)</span>
        {category.details.length > 0 ? (
          <div className="rm-chips" role="radiogroup" aria-labelledby={`${idPrefix}-detail`}>
            {category.details.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={item.id === detailId}
                className={`rm-chip ${item.id === detailId ? 'is-selected' : ''}`}
                onClick={() => onSelectDetail(item)}
              >
                {item.title}
              </button>
            ))}
          </div>
        ) : (
          <p className="rm-field-note">{emptyDetailNote}</p>
        )}
      </div>
      )}
    </div>
  )
}

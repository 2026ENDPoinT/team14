import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { ClipIcon, CloseIcon, TrashIcon } from './icons.jsx'
import { BASE_CATEGORIES, courseOptions, nodeCategoryId, nodeCourseKey, nodeDetailId } from './nodeCategories.js'
import { isCourse } from './layout.js'
import CategoryPicker from './CategoryPicker.jsx'
import { ddayInfo } from './dday.js'

// 노드 상세 창. 노드를 클릭했을 때만 열린다.
// node가 null이 되어도 닫힘 애니메이션 동안 마지막 노드를 보여 준다.
// 학기 가지선은 자동 규칙으로만 그린다 (설정 UI 없음, branchLines.js)
// DUE DATE: 실제 교과목 노드(originKey 'course:...')에는 보이지 않는다
// NODE TYPE: 현재 종류를 누르면 ADD NODE와 같은 카테고리·세부 활동 칩이 펼쳐진다. 저장 버튼을 누르면 반영.
//   종류를 바꿔도 제목은 바꾸지 않는다. 직접 추가한 종류는 customCategories (페이지 공용)
export default function NodeDetailModal({
  node, body, connections, onClose, onSave, onDelete, onOpenNode, customCategories, onAddCustomCategory,
}) {
  const [shown, setShown] = useState(node)
  const [title, setTitle] = useState('')
  const [record, setRecord] = useState('')
  const [saved, setSaved] = useState(false)
  const [categoryId, setCategoryId] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [typeOpen, setTypeOpen] = useState(false) // 종류 선택 칩 펼침
  const [typeChanged, setTypeChanged] = useState(false) // 사용자가 종류를 바꿨는지 (안 바꾸면 theme 그대로)
  const [dueDate, setDueDate] = useState('') // 목표일·마감일 'YYYY-MM-DD' (빈 값 = 없음)
  const [courseKey, setCourseKey] = useState(null) // 전공·학업에서 연결한 교과목 키

  const categories = [...BASE_CATEGORIES, ...customCategories]
  const category = categories.find((c) => c.id === categoryId) ?? categories[0]
  const detail = category.details.find((d) => d.id === detailId) ?? null
  const course = category.id === 'major' && courseKey ? courseOptions().find((c) => c.key === courseKey) ?? null : null
  // 실제 교과목이거나 교과목을 연결한(또는 지금 고른) 노드는 D-DAY를 다루지 않는다
  // (온보딩 교과목은 originKey 기준, 직접 만든 노드는 지금 고른 과목 기준)
  const noDueDate = shown ? isCourse(shown) || (category.id === 'major' && Boolean(courseKey)) : false

  // 다른 노드를 열 때만 입력값을 새로 채운다 (저장 후에는 그대로 유지)
  useEffect(() => {
    if (!node) return
    setShown(node)
    setTitle(node.title)
    setRecord(body)
    setSaved(false)
    setCategoryId(nodeCategoryId(node, categories))
    setDetailId(nodeDetailId(node))
    setTypeOpen(false)
    setTypeChanged(false)
    setDueDate(node.dueDate ?? '')
    setCourseKey(nodeCourseKey(node))
  }, [node?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // 카테고리 변경: 세부 활동 선택만 해제 (제목은 그대로)
  const selectCategory = (id) => {
    if (id === categoryId) return
    setCategoryId(id)
    setDetailId(null)
    if (!isCourse(shown)) setCourseKey(null) // 온보딩 교과목의 과목 연결(originKey)은 바뀌지 않는다
    setTypeChanged(true)
    setSaved(false)
  }
  // 교과목: 하나만, 다시 누르면 해제
  // 새 과목을 직접 고르거나 다른 과목으로 바꾸면 제목 입력칸에 과목명을 넣는다 (해제할 때는 제목 그대로)
  // 입력칸만 바뀌고, 저장 버튼을 눌러야 노드에 반영된다. 제목을 다시 고쳐도 과목 연결(courseKey)은 그대로
  const selectCourse = (item) => {
    if (item.key === courseKey) {
      setCourseKey(null)
    } else {
      setCourseKey(item.key)
      setTitle(item.title)
    }
    setTypeChanged(true)
    setSaved(false)
  }
  // 세부 활동: 하나만, 다시 누르면 해제 (제목은 그대로)
  const selectDetail = (item) => {
    setDetailId(item.id === detailId ? null : item.id)
    setTypeChanged(true)
    setSaved(false)
  }

  const handleSave = () => {
    if (!title.trim()) return
    // 종류를 바꿨을 때만 함께 보낸다. theme은 기존 7개 중 하나, 나머지는 세션 전용 값
    // courseKey: 직접 만든 노드에만 (온보딩 교과목은 originKey로 이미 연결돼 있어 건드리지 않음)
    const type = typeChanged
      ? {
          theme: detail?.theme ?? category.theme,
          categoryId: category.id,
          detailId: detail?.id ?? null,
          categoryLabel: category.label,
          ...(isCourse(shown) ? {} : { courseKey: category.id === 'major' ? courseKey : null }),
        }
      : undefined
    // 교과목(연결 포함)은 날짜를 다루지 않으므로 보내지 않는다 (기존 값은 그대로 둔다)
    const due = noDueDate ? undefined : dueDate || null
    onSave(shown.id, { title: title.trim(), body: record, type, dueDate: due })
    setTypeChanged(false)
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
              <button type="button" className="rm-save-btn" onClick={handleSave}>
                저장
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

          {typeOpen ? (
            <>
              <CategoryPicker
                idPrefix="detail-node"
                categories={categories}
                categoryId={category.id}
                detailId={detailId}
                onSelectCategory={selectCategory}
                onSelectDetail={selectDetail}
                onAddCategory={(name) => selectCategory(onAddCustomCategory(name))}
                resetKey={shown.id}
                customNote="직접 추가한 종류는 아직 서버에 저장되지 않아 새로고침하면 목록에서 사라져요."
                emptyDetailNote="세부 활동이 없는 종류예요."
                courseKey={courseKey}
                onSelectCourse={selectCourse}
                courseLocked={isCourse(shown)}
              />
              <p className="rm-field-note rm-type-note">
                저장 버튼을 누르면 종류가 바뀌어요. 제목은 바뀌지 않아요. 카테고리 이름·세부 활동은 아직 서버에 저장할 곳이 없어 지금 화면에서만 유지돼요.
              </p>
            </>
          ) : (
            <div className="rm-field">
              <span className="rm-eyebrow">NODE TYPE</span>
              <button
                type="button"
                className="rm-type-current"
                aria-label="노드 종류 바꾸기"
                aria-expanded="false"
                onClick={() => setTypeOpen(true)}
              >
                <span>{category.label}{detail ? ` · ${detail.title}` : ''}{course ? ` · ${course.title}` : ''}</span>
                <span className="rm-type-current__edit">변경</span>
              </button>
            </div>
          )}

          {/* 목표일·마감일 (선택). 저장 버튼을 눌러야 반영. 실제 교과목에는 표시하지 않음 */}
          {!noDueDate && (
          <div className="rm-field">
            <span className="rm-eyebrow" id="detail-node-due">DUE DATE (OPTIONAL)</span>
            <div className="rm-due">
              <input
                type="date"
                className="rm-input rm-due__input"
                aria-labelledby="detail-node-due"
                value={dueDate}
                onChange={(e) => { setDueDate(e.target.value); setSaved(false) }}
              />
              {dueDate && (
                <>
                  <span className={`rm-dday is-${ddayInfo(dueDate).tone} is-inline`}>{ddayInfo(dueDate).label}</span>
                  <button type="button" className="rm-due__clear" onClick={() => { setDueDate(''); setSaved(false) }}>
                    날짜 삭제
                  </button>
                </>
              )}
            </div>
            <p className="rm-field-note">
              한국 시간 기준으로 D-DAY를 표시해요. 날짜가 지나도 자동으로 완료되거나 삭제되지 않아요. 지금은 이 화면에서만 유지되고 아직 서버에 저장되지 않아요.
            </p>
          </div>
          )}

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

import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { CloseIcon, TrashIcon } from './icons.jsx'
import { BASE_CATEGORIES, courseOptions, nodeCategoryId, nodeCourseKey, nodeDetailId } from './nodeCategories.js'
import { isCourse } from './layout.js'
import CategoryPicker from './CategoryPicker.jsx'
import { ddayInfo } from './dday.js'
import DeadlineBadge from '../explore/DeadlineBadge.jsx'
import { contestKindLabel, sourceName } from '../explore/contestInfo.js'
import PhotoField from '../photos/PhotoField.jsx'
import usePhotoDraft from '../photos/usePhotoDraft.js'

// 노드 상세 창. 노드를 클릭했을 때만 열린다.
// node가 null이 되어도 닫힘 애니메이션 동안 마지막 노드를 보여 준다.
// 학기 가지선은 자동 규칙으로만 그린다 (설정 UI 없음, branchLines.js)
// 사진: 로그인(DB)일 때만 (photosEnabled). 저장 버튼을 누르면 이름·기록을 저장한 뒤 사진을 올리고 지운다.
// DUE DATE: 실제 교과목 노드(originKey 'course:...')에는 보이지 않는다
// NODE TYPE: 현재 종류를 누르면 ADD NODE와 같은 카테고리·세부 활동 칩이 펼쳐진다. 저장 버튼을 누르면 반영.
//   종류를 바꿔도 제목은 바꾸지 않는다. 직접 추가한 종류는 customCategories (페이지 공용)
export default function NodeDetailModal({
  node, body, connections, onClose, onSave, onDelete, onOpenNode, customCategories, onAddCustomCategory, photosEnabled = false,
}) {
  const [shown, setShown] = useState(node)
  const [title, setTitle] = useState('')
  const [record, setRecord] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false) // 서버에 저장하는 중 (연속 클릭 방지)
  const [saveError, setSaveError] = useState('')
  const [photoError, setPhotoError] = useState('') // 사진 올리기·삭제 실패 안내 (사진 칸 아래)
  const [categoryId, setCategoryId] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [typeOpen, setTypeOpen] = useState(false) // 종류 선택 칩 펼침
  const [typeChanged, setTypeChanged] = useState(false) // 사용자가 종류를 바꿨는지 (안 바꾸면 theme 그대로)
  const [dueDate, setDueDate] = useState('') // 목표일·마감일 'YYYY-MM-DD' (빈 값 = 없음)
  const [courseKey, setCourseKey] = useState(null) // 전공·학업에서 연결한 교과목 키
  const photos = usePhotoDraft(shown ? { nodeId: shown.id } : null, photosEnabled)

  const categories = [...BASE_CATEGORIES, ...customCategories]
  const category = categories.find((c) => c.id === categoryId) ?? categories[0]
  const detail = category.details.find((d) => d.id === detailId) ?? null
  const course = category.id === 'major' && courseKey ? courseOptions().find((c) => c.key === courseKey) ?? null : null
  // 실제 교과목이거나 지금 고른 종류가 기본 '전공·학업'(키 major)이면 D-DAY를 다루지 않는다
  // (사용자 정의 종류는 이름·기반 theme과 상관없이 마감일을 쓸 수 있다)
  const noDueDate = shown ? isCourse(shown) || category.id === 'major' : false

  // 다른 노드를 열 때만 입력값을 새로 채운다 (저장 후에는 그대로 유지)
  useEffect(() => {
    if (!node) return
    setShown(node)
    setTitle(node.title)
    setRecord(body)
    setSaved(false)
    setSaveError('')
    setPhotoError('')
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

  // onSave는 { ok, message }를 돌려준다. 저장에 성공했을 때만 '저장됨'을 표시한다.
  const handleSave = async () => {
    if (!title.trim() || saving) return
    // 종류를 바꿨을 때만 함께 보낸다. theme은 기존 7개 중 하나 (카테고리·세부 활동은 DB에 저장)
    // courseKey: 직접 만든 노드에만, 세션 전용 (온보딩 교과목은 originKey로 이미 연결돼 있어 건드리지 않음)
    const type = typeChanged
      ? {
          theme: detail?.theme ?? category.theme,
          categoryId: category.id,
          detailId: detail?.id ?? null,
          categoryLabel: category.label,
          ...(isCourse(shown) ? {} : { courseKey: category.id === 'major' ? courseKey : null }),
        }
      : undefined
    // 전공·학업·교과목은 날짜를 다루지 않으므로 보내지 않는다 (기존 값은 지우지 않고 화면에서만 숨김). dueDate는 세션 전용
    const due = noDueDate ? undefined : dueDate || null
    setSaving(true)
    setSaveError('')
    setPhotoError('')
    const result = await onSave(shown.id, { title: title.trim(), body: record, type, dueDate: due })
    if (!result?.ok) {
      setSaving(false)
      return setSaveError(result?.message ?? '저장하지 못했어요.') // 입력값·바꾼 종류·날짜·고른 사진은 그대로 둔다
    }
    setTypeChanged(false)
    // 사진: 새로 고른 사진 올리기·지운 사진 삭제. 실패한 사진은 남겨 두고 저장을 다시 누르면 다시 올린다
    if (photos.dirty) {
      const photoResult = await photos.commit({ nodeId: shown.id })
      if (photoResult.failed > 0) {
        setSaving(false)
        setSaveError('사진 저장 실패')
        return setPhotoError(`이름·기록은 저장했어요. 사진 ${photoResult.failed}장을 처리하지 못했어요(빨간 테두리). 저장을 다시 누르면 그 사진만 다시 올려요. ${photoResult.message}`)
      }
    }
    setSaving(false)
    setSaved(true)
  }

  const handleDelete = () => {
    if (window.confirm(`'${title || shown.title}' 활동을 삭제할까요? 나의 기록도 함께 삭제돼요.`)) {
      onDelete(shown.id)
    }
  }

  return (
    <Modal open={Boolean(node)} onClose={onClose} label="활동 상세">
      {shown && (
        <div className="rm-form">
          <header className="rm-modal__head">
            <p className="rm-eyebrow">활동 상세</p>
            <div className="rm-modal__actions">
              {saving && <span className="rm-saved">저장 중…</span>}
              {saved && !saving && <span className="rm-saved">저장됨</span>}
              {saveError && <span className="rm-saved rm-save-error" role="alert">{saveError}</span>}
              <button type="button" className="rm-save-btn" onClick={handleSave} disabled={saving} title="이름·종류·기록·마감일·사진 변경 내용을 저장해요">
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
            aria-label="활동 이름"
            onChange={(e) => { setTitle(e.target.value); setSaved(false) }}
          />

          {/* 탐색에서 추가한 대외활동: 분류·출처·마감일·원문 링크 (공고 정보는 수집 데이터에서 읽어 오며 여기서 고치지 않는다) */}
          {shown.contest && (
            <div className="rm-field">
              <span className="rm-eyebrow">{contestKindLabel(shown.contest.sourceTag)} 정보</span>
              <dl className="rm-contest-info">
                <dt>분류</dt>
                <dd>{contestKindLabel(shown.contest.sourceTag)}</dd>
                <dt>출처</dt>
                <dd>{sourceName(shown.contest.source)}</dd>
                <dt>마감일</dt>
                <dd>
                  {shown.contest.deadline ?? '정보 없음'}
                  <DeadlineBadge deadline={shown.contest.deadline} status={shown.contest.sourceStatus} />
                </dd>
                <dt>원문</dt>
                <dd>
                  <a href={shown.contest.url} target="_blank" rel="noopener noreferrer">공고 원문 보기</a>
                </dd>
              </dl>
            </div>
          )}

          {/* 탐색에서 추가한 채용 공고: 공고명·기업명·출처·마감일·원문 링크 (수집 데이터에서 읽어 오며 여기서 고치지 않는다) */}
          {shown.job && (
            <div className="rm-field">
              <span className="rm-eyebrow">채용 정보</span>
              <dl className="rm-contest-info" data-testid="job-info">
                <dt>공고명</dt>
                <dd>{shown.job.title}</dd>
                <dt>기업명</dt>
                <dd>{shown.job.company ?? '정보 없음'}</dd>
                <dt>출처</dt>
                <dd>{sourceName(shown.job.source)}</dd>
                <dt>마감일</dt>
                <dd>
                  {shown.job.deadline ?? '정보 없음 (원문에서 확인해 주세요)'}
                  <DeadlineBadge deadline={shown.job.deadline} />
                </dd>
                <dt>원문</dt>
                <dd>
                  {shown.job.url
                    ? <a href={shown.job.url} target="_blank" rel="noopener noreferrer">공고 원문 보기</a>
                    : '원문 링크가 없어요'}
                </dd>
              </dl>
            </div>
          )}

          {typeOpen ? (
            <>
              <CategoryPicker
                idPrefix="detail-node"
                categories={categories}
                categoryId={category.id}
                detailId={detailId}
                onSelectCategory={selectCategory}
                onSelectDetail={selectDetail}
                onAddCategory={async (name) => {
                  // 서버에 저장되면 바로 선택. 실패하면 오류 문구를 돌려준다
                  const result = await onAddCustomCategory(name)
                  if (result.error) return result.error
                  selectCategory(result.id)
                  return null
                }}
                resetKey={shown.id}
                customNote="직접 추가한 종류는 내 계정에 저장돼요."
                emptyDetailNote="세부 활동이 없는 종류예요."
                courseKey={courseKey}
                onSelectCourse={selectCourse}
                courseLocked={isCourse(shown)}
              />
              <p className="rm-field-note rm-type-note">
                저장 버튼을 누르면 종류가 바뀌어요. 카테고리·세부 활동은 로그인한 내 로드맵에 저장돼요. 교과목 연결은 아직 서버에 저장할 곳이 없어 지금 화면에서만 유지돼요.
              </p>
            </>
          ) : (
            <div className="rm-field">
              <span className="rm-eyebrow">종류</span>
              <button
                type="button"
                className="rm-type-current"
                aria-label="활동 종류 바꾸기"
                aria-expanded="false"
                onClick={() => setTypeOpen(true)}
              >
                <span>{category.label}{detail ? ` · ${detail.title}` : ''}{course ? ` · ${course.title}` : ''}</span>
                <span className="rm-type-current__edit">변경</span>
              </button>
            </div>
          )}

          {/* 목표일·마감일 (선택). 저장 버튼을 눌러야 반영. 전공·학업 종류·실제 교과목에는 표시하지 않음 */}
          {!noDueDate && (
          <div className="rm-field">
            <span className="rm-eyebrow" id="detail-node-due">마감일 (선택)</span>
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
              한국 시간 기준으로 D-DAY를 보여 줘요. 날짜가 지나도 자동으로 완료·삭제되지 않아요. (마감일은 아직 서버에 저장되지 않아 이 화면에서만 유지돼요)
            </p>
          </div>
          )}

          <label className="rm-field">
            <span className="rm-eyebrow">나의 기록</span>
            <textarea
              className="rm-input rm-textarea rm-textarea--tall"
              placeholder="활동하면서 배운 점, 링크, 회의 기록 등을 적어 보세요"
              value={record}
              onChange={(e) => { setRecord(e.target.value); setSaved(false) }}
            />
          </label>

          {/* 첨부: 사진만 (파일·링크 첨부는 SPEC 6.5 [미확정]) */}
          <div className="rm-field">
            <span className="rm-eyebrow">첨부 사진</span>
            <PhotoField
              draft={photos}
              disabledNote={photosEnabled ? '' : '로그인하면 사진을 첨부할 수 있어요.'}
              onChange={() => setSaved(false)}
            />
            {photoError && <p className="rm-field-note is-error" role="alert">{photoError}</p>}
          </div>

          <div className="rm-field">
            <span className="rm-eyebrow">연결된 활동</span>
            <div className="rm-chips">
              {connections.length === 0 && <span className="rm-muted">연결된 활동이 없어요. 캔버스에서 이 활동을 다른 활동 위에 끌어 놓으면 이어져요.</span>}
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

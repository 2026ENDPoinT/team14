import { useCallback, useEffect, useRef, useState } from 'react'
import { PHOTO_MAX_COUNT, checkPhotoFile, deletePhoto, listPhotos, uploadPhoto } from '../../services/photos.js'

// 사진 첨부 편집 상태 (로드맵 활동 상세 · 일기 공용)
// - 저장된 사진은 서버에서 불러오고(서명 URL), 새로 고른 사진은 브라우저 미리보기로만 보여 준다.
// - 저장 버튼을 누를 때 commit(target)으로 새 사진을 올리고, 지운 사진을 서버에서 지운다.
// - 올리기에 실패한 사진은 '실패'로 남아 다음 저장 때 다시 올린다. 이미 저장된 사진은 그대로 둔다.
// item: { key, kind: 'saved'|'new', id?, path?, url, file?, status: 'ok'|'uploading'|'failed', error? }
// target: { nodeId } 또는 { diaryId } — 바뀌면 다시 불러온다. 없으면(새 일기) 빈 목록에서 시작하고 commit(target)으로 저장
export default function usePhotoDraft(target, enabled = true) {
  const [items, setItems] = useState([])
  const [removed, setRemoved] = useState([]) // 지우기로 표시한 저장된 사진 (저장할 때 서버에서 지움)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const itemsRef = useRef(items)
  itemsRef.current = items
  const removedRef = useRef(removed)
  removedRef.current = removed
  const key = target ? `${target.nodeId ? 'node' : 'diary'}:${target.nodeId ?? target.diaryId}` : ''

  // 브라우저 미리보기 주소 정리 (onlyNew: 아직 올리지 않은 사진만)
  const revokeAll = (list, onlyNew = false) =>
    list.forEach((p) => p.url?.startsWith('blob:') && (!onlyNew || p.kind === 'new') && URL.revokeObjectURL(p.url))

  const load = useCallback(async () => {
    revokeAll(itemsRef.current)
    setItems([])
    setRemoved([])
    setLoadError('')
    if (!enabled || !target) return
    setLoading(true)
    const result = await listPhotos(target)
    setLoading(false)
    if (result.error) return setLoadError(`${result.error.message} 다시 열면 다시 불러와요.`)
    // 불러오는 사이에 고른 사진(new)은 지우지 않고 뒤에 둔다
    const saved = result.data.map((p) => ({ ...p, key: p.id, kind: 'saved', status: 'ok' }))
    setItems((prev) => [...saved, ...prev.filter((p) => p.kind === 'new')])
  }, [key, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => () => revokeAll(itemsRef.current), [])

  // 사진 고르기 → 미리보기 목록에 추가. 문제가 있으면 안내 문구를 돌려준다
  const addFiles = (fileList) => {
    const files = [...fileList]
    const room = PHOTO_MAX_COUNT - itemsRef.current.length
    const messages = []
    const added = []
    for (const file of files) {
      const problem = checkPhotoFile(file)
      if (problem) messages.push(`${file.name}: ${problem}`)
      else if (added.length >= room) messages.push(`사진은 ${PHOTO_MAX_COUNT}장까지 남길 수 있어요.`)
      else added.push({ key: `new-${crypto.randomUUID()}`, kind: 'new', file, url: URL.createObjectURL(file), status: 'ok' })
    }
    if (added.length) setItems((prev) => [...prev, ...added])
    return [...new Set(messages)].join(' ')
  }

  const remove = (itemKey) => {
    const item = itemsRef.current.find((p) => p.key === itemKey)
    if (!item) return
    if (item.kind === 'new') URL.revokeObjectURL(item.url)
    else setRemoved((prev) => [...prev, item])
    setItems((prev) => prev.filter((p) => p.key !== itemKey))
  }

  // 편집 취소: 새로 고른 사진은 버리고, 지운 사진은 되돌린다
  const reset = () => {
    revokeAll(itemsRef.current, true)
    setItems((prev) => [...prev.filter((p) => p.kind === 'saved'), ...removedRef.current])
    setRemoved([])
  }

  // 대상(일기 등)을 지운 뒤 목록 비우기
  const clear = () => {
    revokeAll(itemsRef.current)
    setItems([])
    setRemoved([])
  }

  const patch = (itemKey, values) => setItems((prev) => prev.map((p) => (p.key === itemKey ? { ...p, ...values } : p)))

  // 서버에 반영: 지운 사진 삭제 → 새 사진(또는 실패했던 사진) 차례로 올리기
  // 결과: { failed: 실패한 장 수, message } (0이면 모두 성공)
  const commit = async (saveTarget = target) => {
    let failed = 0
    const errors = []
    for (const photo of removedRef.current) {
      const result = await deletePhoto(photo)
      if (result.error) {
        failed += 1
        errors.push(result.error.message)
      } else setRemoved((prev) => prev.filter((p) => p.key !== photo.key))
    }
    for (const item of itemsRef.current.filter((p) => p.kind === 'new')) {
      patch(item.key, { status: 'uploading', error: '' })
      const result = await uploadPhoto(saveTarget, item.file)
      if (result.error) {
        failed += 1
        errors.push(result.error.message)
        patch(item.key, { status: 'failed', error: result.error.message })
      } else {
        // 미리보기 주소는 그대로 쓰고(다시 받지 않음), 저장된 사진으로 바꾼다
        patch(item.key, { kind: 'saved', id: result.data.id, path: result.data.path, status: 'ok', file: null })
      }
    }
    return { failed, message: [...new Set(errors)].join(' ') }
  }

  const dirty = removed.length > 0 || items.some((p) => p.kind === 'new')
  return { items, loading, loadError, dirty, addFiles, remove, reset, clear, commit, reload: load }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FILE_MAX_COUNT,
  LINK_MAX_COUNT,
  addLink,
  checkAttachmentFile,
  deleteAttachment,
  listAttachments,
  normalizeLink,
  uploadAttachment,
} from '../../services/attachments.js'

// 활동 상세의 링크·파일 첨부 편집 상태 (사진의 usePhotoDraft와 같은 방식)
// - 저장된 첨부는 서버에서 불러오고, 새로 넣은 링크·파일은 '저장 전'으로 보여 준다.
// - 저장 버튼을 누를 때 commit(nodeId)으로 새 첨부를 저장하고, 지운 첨부를 서버에서 지운다.
// - 실패한 항목은 '실패'로 남아 다음 저장 때 다시 시도한다. 이미 저장된 첨부는 그대로 둔다.
// item: { key, kind: 'link'|'file', saved, id?, name, url?, path?, size?, file?, status: 'ok'|'uploading'|'failed', error? }
export default function useAttachmentDraft(nodeId, enabled = true) {
  const [items, setItems] = useState([])
  const [removed, setRemoved] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const itemsRef = useRef(items)
  itemsRef.current = items
  const removedRef = useRef(removed)
  removedRef.current = removed

  const load = useCallback(async () => {
    setItems([])
    setRemoved([])
    setLoadError('')
    if (!enabled || !nodeId) return
    setLoading(true)
    const result = await listAttachments(nodeId)
    setLoading(false)
    if (result.error) return setLoadError(`${result.error.message} 다시 열면 다시 불러와요.`)
    // 불러오는 사이에 넣은 새 첨부는 지우지 않고 뒤에 둔다
    const saved = result.data.map((a) => ({ ...a, key: a.id, saved: true, status: 'ok' }))
    setItems((prev) => [...saved, ...prev.filter((p) => !p.saved)])
  }, [nodeId, enabled])

  useEffect(() => {
    load()
  }, [load])

  const count = (kind) => itemsRef.current.filter((p) => p.kind === kind).length
  const newKey = () => `new-${crypto.randomUUID()}`

  // 링크 넣기 → 문제가 있으면 안내 문구, 없으면 ''
  const addLinkItem = ({ url, name }) => {
    const checked = normalizeLink(url)
    if (checked.error) return checked.error
    if (count('link') >= LINK_MAX_COUNT) return `링크는 ${LINK_MAX_COUNT}개까지 추가할 수 있어요.`
    setItems((prev) => [...prev, { key: newKey(), kind: 'link', saved: false, url: checked.url, name: name.trim() || checked.url, status: 'ok' }])
    return ''
  }

  // 파일 넣기 → 문제가 있으면 안내 문구
  const addFiles = (fileList) => {
    const messages = []
    const added = []
    let room = FILE_MAX_COUNT - count('file')
    for (const file of [...fileList]) {
      const problem = checkAttachmentFile(file)
      if (problem) messages.push(`${file.name}: ${problem}`)
      else if (room <= 0) messages.push(`파일은 ${FILE_MAX_COUNT}개까지 첨부할 수 있어요.`)
      else {
        added.push({ key: newKey(), kind: 'file', saved: false, file, name: file.name, size: file.size, status: 'ok' })
        room -= 1
      }
    }
    if (added.length) setItems((prev) => [...prev, ...added])
    return [...new Set(messages)].join(' ')
  }

  const remove = (itemKey) => {
    const item = itemsRef.current.find((p) => p.key === itemKey)
    if (!item) return
    if (item.saved) setRemoved((prev) => [...prev, item])
    setItems((prev) => prev.filter((p) => p.key !== itemKey))
  }

  const reset = () => {
    setItems((prev) => [...prev.filter((p) => p.saved), ...removedRef.current])
    setRemoved([])
  }

  const patch = (itemKey, values) => setItems((prev) => prev.map((p) => (p.key === itemKey ? { ...p, ...values } : p)))

  // 서버에 반영: 지운 첨부 삭제 → 새 링크·파일 차례로 저장. 결과 { failed, message }
  const commit = async (saveNodeId = nodeId) => {
    let failed = 0
    const errors = []
    for (const item of removedRef.current) {
      const result = await deleteAttachment(item)
      if (result.error) {
        failed += 1
        errors.push(result.error.message)
      } else setRemoved((prev) => prev.filter((p) => p.key !== item.key))
    }
    for (const item of itemsRef.current.filter((p) => !p.saved)) {
      patch(item.key, { status: 'uploading', error: '' })
      const result = item.kind === 'link'
        ? await addLink(saveNodeId, { url: item.url, name: item.name })
        : await uploadAttachment(saveNodeId, item.file)
      if (result.error) {
        failed += 1
        errors.push(result.error.message)
        patch(item.key, { status: 'failed', error: result.error.message })
      } else {
        patch(item.key, { ...result.data, key: item.key, saved: true, status: 'ok', file: null })
      }
    }
    return { failed, message: [...new Set(errors)].join(' ') }
  }

  const dirty = removed.length > 0 || items.some((p) => !p.saved)
  return { items, loading, loadError, dirty, addLink: addLinkItem, addFiles, remove, reset, commit, reload: load }
}

import usePresence from './usePresence.js'

// 노드 생성·상세 창이 함께 쓰는 팝업 틀 (배경 클릭 시 닫힘, 확대·페이드 애니메이션)
export default function Modal({ open, onClose, label, children }) {
  const { mounted, visible } = usePresence(open)
  if (!mounted) return null

  return (
    <div className={`rm-modal ${visible ? 'is-visible' : ''}`}>
      <div className="rm-modal__backdrop" onClick={onClose} />
      <div className="rm-modal__card" role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>
  )
}

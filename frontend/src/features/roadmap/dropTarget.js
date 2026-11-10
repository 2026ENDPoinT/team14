import { createContext } from 'react'

// 드래그 중 노드가 놓일 학기 id (없으면 null).
// 노드 목록을 다시 만들지 않고 학기 배경만 강조하려고 Context로 전달한다.
export const DropTargetContext = createContext(null)

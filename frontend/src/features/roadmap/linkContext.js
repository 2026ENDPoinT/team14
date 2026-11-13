import { createContext } from 'react'

// 관계선 연결 상태를 노드 카드에 전달한다. (노드 목록을 다시 만들지 않고 카드 표시만 바꾸려고 Context 사용)
// - connectMode: CONNECT 모드인지 (카드 오른쪽에 연결 핸들 표시)
// - startConnect(event, nodeId): 연결 핸들을 누르면 새 관계선 드래그 시작
// - startConnectDrag(event, nodeId): CONNECT 모드에서 카드 몸통을 누름 → 4px 넘게 끌면 새 관계선 드래그 시작
// - target: 드래그 중 강조할 노드 { id, valid, swap } (관계선 대상, 또는 swap: 자리 교환 대상)
export const LinkContext = createContext({ connectMode: false, startConnect: () => {}, startConnectDrag: () => {}, target: null })

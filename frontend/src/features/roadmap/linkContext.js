import { createContext } from 'react'

// 관계선 연결 상태를 노드 카드에 전달한다. (노드 목록을 다시 만들지 않고 카드 표시만 바꾸려고 Context 사용)
// - connectMode: CONNECT 모드인지 (카드 오른쪽에 연결 핸들 표시)
// - startConnect(event, nodeId): 연결 핸들을 누르면 새 관계선 드래그 시작
// - target: 드래그 중 마우스 아래 노드 { id, valid } (카드 강조용)
export const LinkContext = createContext({ connectMode: false, startConnect: () => {}, target: null })

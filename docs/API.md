# API.md — 프론트엔드 ↔ Supabase 데이터 규격

> 관리 책임: 3번(DB·기술 관리). 변경 시 팀 협의 후 이 문서를 먼저 수정한다.
> 구조: **프론트엔드 → Supabase SDK → Supabase(PostgreSQL + Auth)**. MVP에서는 Node 서버를 사용하지 않는다.
> 프론트엔드는 DB가 준비되기 전까지 이 문서의 JSON 형식(camelCase)으로 Mock Data를 만들어 개발한다.

## 1. 공통 규칙

### 1.1 연결 구조
- DB와 인증은 프론트엔드에서 **Supabase SDK**(`@supabase/supabase-js`)로 직접 연결한다.
- 여러 데이터를 함께 바꾸는 작업과 보상 지급은 **PostgreSQL 함수(RPC)** 로 처리한다. (3장, 4장)
- Node 서버(`backend/`)는 MVP에서 사용하지 않는다. 폴더는 삭제하지 않고 유지한다.
  - 추후 서버 전용 기능이 필요할 때만 사용하며, 이때 로컬 포트는 `4000`이다. (`http://localhost:4000`)
- DB 변경(테이블·RLS·함수)은 SQL 파일로 `supabase/migrations/`에 저장해 Git으로 공유한다.

### 1.2 이름 규칙 (snake_case ↔ camelCase)
- PostgreSQL 테이블·컬럼: **snake_case** (예: `user_id`, `created_at`, `period_id`)
- React 코드와 이 문서의 JSON 예시: **camelCase** (예: `userId`, `createdAt`, `periodId`)
- 변환은 **공통 서비스 계층**(`frontend/src/services/`)에서만 한다. 컴포넌트는 snake_case를 직접 다루지 않는다.

### 1.3 값 형식
- ID: `uuid` 문자열 (예시의 `"n_1"` 같은 값은 Mock Data용 표기)
- 시간: ISO 8601 문자열 (`2026-11-09T12:00:00+09:00`)
- 날짜(일기): `YYYY-MM-DD`, **한국 시간(KST) 기준**

### 1.4 인증 · 데이터 접근
- 로그인: Supabase Auth (이메일·비밀번호, Google 로그인)
- 로그인 세션(토큰)은 Supabase SDK가 관리한다. 프론트 코드에서 토큰을 직접 저장·전송하지 않는다.
- 모든 사용자 데이터 테이블에 **RLS(행 수준 보안)** 를 켠다. 로그인한 사용자 본인 행(`user_id = auth.uid()`)만 조회·수정할 수 있다. (5장)
- DB 함수(RPC)도 함수 안에서 `auth.uid()`로 로그인 사용자를 확인하고, 본인 데이터만 다룬다.

### 1.5 오류 형식
Supabase SDK는 `{ data, error }`를 돌려준다. 서비스 계층은 오류를 아래 형식으로 통일해 컴포넌트에 전달한다.
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "제목은 필수입니다." } }
```

| code | 의미 |
| --- | --- |
| VALIDATION_ERROR | 잘못된 요청 (필수값 누락 등) |
| UNAUTHENTICATED | 로그인 필요 / 세션 만료 |
| FORBIDDEN | 다른 사용자의 데이터 접근 (RLS 차단) |
| NOT_FOUND | 존재하지 않음 |
| CONFLICT | 충돌 (예: 이미 존재, 이미 온보딩 완료) |
| SERVER_ERROR | 그 밖의 오류 |

## 2. 공통 데이터 구조

아래 JSON은 **서비스 계층이 컴포넌트에 돌려주는 형식(camelCase)** 이다. 괄호 안은 DB 테이블 이름이다.

### User (`profiles` + Supabase `auth.users`)
```json
{
  "id": "u_1",
  "email": "a@example.com",
  "nickname": "민수",
  "grade": 2,
  "onboardingCompleted": false,
  "interests": ["backend", "ai"],
  "createdAt": "2026-11-09T12:00:00+09:00"
}
```
- 로그인 정보(이메일·비밀번호·Google 계정)는 Supabase `auth.users`가 관리한다.
- 닉네임·학년 등은 `profiles` 테이블에 둔다. `profiles.id` = `auth.users.id`.
- **회원가입 시 최소 `profiles` 행을 자동 생성**한다. (`onboardingCompleted: false`) 이미 있으면 다시 만들지 않는다.
- `nickname` 중복 허용. `grade`는 나중에 변경 가능.

### TimelinePeriod (학기/기간, `timeline_periods`)
```json
{
  "id": "p_1",
  "type": "semester",
  "name": "1학년 1학기",
  "order": 0
}
```
- `type`: `"semester"` | `"leave"`(휴학) | `"military"`(군 복무) | `"exchange"`(교환학생) | `"extra"`(초과학기) | `"custom"`
- `order`: 왼쪽→오른쪽 순서. 삽입 시 뒤 기간의 order가 +1 된다.
- 기본 8개(1-1 ~ 4-2)가 `semester`로 **온보딩 완료 시** 생성되며, 이름·순서·타입 수정 가능.

### Node (`nodes`)
```json
{
  "id": "n_1",
  "title": "자료구조",
  "theme": "major",
  "periodId": "p_3",
  "position": { "x": 120, "y": 80 },
  "status": "placed",
  "source": "recommended",
  "originKey": "backend:data-structure",
  "createdAt": "2026-11-09T12:00:00+09:00"
}
```
- `periodId`: `null`이면 **보관함**에 있는 노드
- `status`: `"placed"`(학기에 배치) | `"stored"`(보관함)
- `theme`: `major` | `project` | `external` | `career` | `research` | `event` | `free` | 사용자 정의 테마 ID
- `source`: `"user"` | `"onboarding"` | `"recommended"` | `"explore"`
- `originKey`: 추천/온보딩에서 생성된 노드의 중복 생성 방지 키 (없으면 `null`). DB에 `(user_id, origin_key)` 유일 제약을 둔다.
- `position`: 학기 영역 내 상대 좌표 `[React Flow 좌표 기준 협의 필요]`

### Edge (사용자 연결선, `edges`)
```json
{ "id": "e_1", "sourceNodeId": "n_1", "targetNodeId": "n_2" }
```

### NodeDocument (`node_documents`)
```json
{
  "nodeId": "n_1",
  "content": { "format": "plain", "body": "회의 내용..." },
  "updatedAt": "2026-11-09T12:00:00+09:00"
}
```
- MVP: `format: "plain"`(텍스트/마크다운). TipTap 도입 시 `"tiptap-json"` 추가 `[미확정]`
- 노드와 1:1. 노드 삭제 시 문서도 삭제, **학기 삭제 시에는 삭제되지 않는다.**
- 회고 작성 여부 판단용 `isReflection` 필드 `[미확정]`

### Diary (`diaries`)
```json
{
  "id": "d_1",
  "date": "2026-11-09",
  "mood": "happy",
  "content": "오늘은...",
  "photoUrls": [],
  "linkedNodeId": null,
  "createdAt": "2026-11-09T12:00:00+09:00",
  "updatedAt": "2026-11-09T12:00:00+09:00"
}
```
- 사용자당 **날짜별 일기 1개** (`(user_id, date)` 유일). 같은 날 재작성은 수정으로 처리.
- `mood` 값 목록 `[미확정]`
- `photoUrls`: 사진 첨부는 단계적 적용, MVP에서는 빈 배열 가능

### Pet (`pets`)
```json
{
  "id": "pet_1",
  "type": "backend",
  "stage": 1,
  "energy": 25,
  "energyToNextStage": 50,
  "updatedAt": "2026-11-09T12:00:00+09:00"
}
```
- 사용자당 1마리. **온보딩 완료 시** 생성한다.
- `type`: 관심 분야에 따른 외형 키 `[미확정]`
- 단계 수와 필요 에너지는 `[미확정]`. DB 설정값으로 관리하여 쉽게 바꿀 수 있게 한다. (관리 방식 `[미확정]`)
- **프론트에서 직접 수정할 수 없다.** (조회만 가능, 5장)

### RewardEvent (보상 이력, `reward_events`)
```json
{
  "id": "r_1",
  "type": "diary_first_of_day",
  "refId": "2026-11-09",
  "energy": 10,
  "createdAt": "2026-11-09T12:00:00+09:00"
}
```
- `type`: `diary_first_of_day` | `node_reflection` | `semester_reflection`
- `refId`: 일기는 날짜, 노드 회고는 nodeId, 학기 회고는 periodId
- **프론트에서 직접 추가·수정·삭제할 수 없다.** (조회만 가능, 5장)

## 3. 중복 보상 방지 규칙 (DB 함수에서 판단)

프론트엔드가 아닌 **DB 함수(RPC)가 최종 판단**한다. DB에 `(user_id, type, ref_id)` 유일 제약을 둔다.

| type | refId | 한도 |
| --- | --- | --- |
| diary_first_of_day | 날짜(KST) | 사용자·날짜당 1회 |
| node_reflection | nodeId | 노드당 1회 |
| semester_reflection | periodId | 학기당 1회 |

- 보상 지급 함수는 하나의 트랜잭션에서 **로그인 사용자 확인 → 데이터 저장 → 보상 이력 추가 → 펫 에너지 증가**를 처리한다. 중간에 실패하면 전부 취소된다.
- 같은 요청이 동시에 여러 번 와도 유일 제약 때문에 보상은 한 번만 들어간다.
- 일기 수정·삭제 후 재작성으로 보상을 다시 받을 수 없다. (삭제해도 RewardEvent는 유지)
- 로그인/접속 자체는 보상 없음.
- 이미 지급된 경우 오류가 아니라 `rewarded: false`로 정상 응답한다.
- 보상 수치(+10 등)는 SPEC.md 8장의 **제안값**이며 확정 아님.

## 4. 데이터 작업 목록

컴포넌트는 `frontend/src/services/`의 함수만 호출한다. 아래 "처리 방식"은 서비스 함수 안에서 하는 일이다.
- **테이블**: Supabase SDK로 테이블을 직접 조회·수정 (RLS로 본인 데이터만 허용)
- **RPC**: DB 함수 호출. 함수 이름은 `(안)`이며 SQL 작성 시 확정한다.

### 4.1 인증 · 내 정보

| 작업 | 처리 방식 | 설명 |
| --- | --- | --- |
| 이메일 가입 | Supabase Auth (`signUp`) | 가입 시 `profiles` 행 자동 생성 |
| 이메일 로그인 | Supabase Auth (`signInWithPassword`) | |
| Google 로그인 | Supabase Auth (`signInWithOAuth`, provider: google) | Google Cloud·Supabase 대시보드 설정 필요 |
| 로그아웃 | Supabase Auth (`signOut`) | |
| 내 정보 조회 | 테이블 `profiles` 조회 | 반환: User |
| 내 정보 수정 | 테이블 `profiles` 수정 | 닉네임·학년·관심 분야 |

- 로그인 후 `onboardingCompleted`가 `false`이면 `/onboarding`으로, `true`이면 `/`(홈)으로 이동한다.

### 4.2 온보딩

| 작업 | 처리 방식 | 설명 |
| --- | --- | --- |
| 온보딩 완료 | RPC `complete_onboarding` (안) | 프로필 저장 + 기본 8학기 + 펫 + 경험 노드 생성을 한 번에 처리 |

```json
// 요청 (모든 필드 선택, 건너뛰기 가능)
{
  "nickname": "민수",
  "grade": 2,
  "experiences": ["hackathon", "club"],
  "completedCourses": ["CS101", "CS201"],
  "interests": ["backend"],
  "roadmapMode": "auto"
}
// roadmapMode: "auto"(학기에 자동 배치) | "inbox"(보관함에만 추가)
// 성공
{ "user": { /* User */ }, "nodes": [ /* Node[] */ ], "periods": [ /* TimelinePeriod[] */ ], "pet": { /* Pet */ } }
```
- 모든 단계를 건너뛰어도 이 함수를 호출해 기본 8학기와 펫을 만든다. (빈 로드맵·빈 보관함으로 정상 동작)
- `experiences` → 보관함 노드(`status: "stored"`, `source: "onboarding"`)
- `completedCourses`는 학기에 자동 배치하지 않는다.
- **중복 호출 안전:** 이미 완료한 사용자가 다시 호출하면 아무것도 새로 만들지 않고 `CONFLICT`를 돌려준다. 학기·펫은 사용자당 한 번만 생성된다.

### 4.3 로드맵

| 작업 | 처리 방식 | 설명 |
| --- | --- | --- |
| 로드맵 조회 | 테이블 `timeline_periods`, `nodes`, `edges` 조회 | periods + nodes + edges 한 번에 반환 |
| 학기/기간 삽입 | RPC `insert_period` (안) | 삽입 위치 지정, 뒤 기간 order 재계산 |
| 학기/기간 삭제 | RPC `delete_period` (안) | 소속 노드를 보관함으로 이동 후 삭제 |
| 학기 순서 변경 | RPC `reorder_periods` (안) | 여러 행의 order를 함께 변경 |
| 학기 이름·타입 수정 | 테이블 `timeline_periods` 수정 | 한 행만 바뀌므로 직접 수정 |
| 노드 생성 | 테이블 `nodes` 추가 | |
| 노드 수정 | 테이블 `nodes` 수정 | 제목·테마·위치·periodId |
| 노드 복제 | 서비스 함수에서 처리 | 처리 방식(테이블 추가 / RPC) `[미확정]` |
| 노드 삭제 | 테이블 `nodes` 삭제 | 문서도 함께 삭제 |
| 연결선 생성 | 테이블 `edges` 추가 | |
| 연결선 삭제 | 테이블 `edges` 삭제 | |

```json
// 로드맵 조회 결과
{ "periods": [ /* TimelinePeriod[] */ ], "nodes": [ /* Node[] */ ], "edges": [ /* Edge[] */ ] }

// 학기 삽입 요청 (2학년 2학기 뒤에 휴학 삽입)
{ "type": "leave", "name": "휴학", "insertAfterPeriodId": "p_4" }
// 결과 → 갱신된 periods 전체 (order 재계산됨)
{ "periods": [ /* TimelinePeriod[] */ ] }

// 학기 삭제 결과
{ "deleted": "p_3", "movedNodeIds": ["n_1", "n_2"] }

// 노드 수정 요청 (드래그 후 위치 저장)
{ "periodId": "p_3", "position": { "x": 140, "y": 90 } }
```
- **중복 호출 안전:** 이미 삭제된 학기를 다시 삭제해도 노드가 사라지거나 오류로 데이터가 꼬이지 않는다. 학기 삽입·삭제는 트랜잭션으로 처리한다.

### 4.4 분야별 추천 로드맵

| 작업 | 처리 방식 | 설명 |
| --- | --- | --- |
| 추천 초안 조회 | 서비스 함수에서 처리 | 분야별 추천 노드 초안 (저장 안 함) |
| 추천 반영 | RPC `apply_recommendations` (안) | 여러 노드를 한 번에 생성, originKey 중복 방지 |

```json
// 추천 반영 요청
{ "fields": ["backend"], "mode": "auto" }
// mode: "auto"(권장 학기에 배치) | "inbox"(보관함에만)
// 결과
{ "created": [ /* Node[] */ ], "skipped": ["backend:data-structure"] }
```
- 이미 존재하는 `originKey`는 `skipped`로 처리해 중복 생성하지 않는다. (`(user_id, origin_key)` 유일 제약)
- 전공 수업 노드와 직무 기술 노드를 구분 (`originKey` 접두어/테마로 구분 `[규칙 협의 필요]`).
- 추천 데이터 원본은 `frontend/src/data/` 또는 Supabase 테이블 중 어디에 둘지 4번·3번 협의 `[미확정]` (Node 서버 미사용으로 "백엔드 JSON" 선택지는 제외)

### 4.5 노드 문서

| 작업 | 처리 방식 | 설명 |
| --- | --- | --- |
| 문서 조회 | 테이블 `node_documents` 조회 | 없으면 빈 문서 반환 |
| 문서 저장 | 테이블 `node_documents` 저장(upsert) | 자동 저장 호출 |

```json
// 저장 요청
{ "content": { "format": "plain", "body": "회의 내용..." } }
// 결과
{ "document": { /* NodeDocument */ }, "reward": { "rewarded": false } }
```
- 노드 회고·학기 회고 보상의 지급 방식(함수 이름, 회고 판정 기준) `[미확정]`.
  보상 이력·펫은 프론트에서 직접 쓸 수 없으므로, 확정되면 일기와 같이 RPC 함수로 구현한다.

### 4.6 일기 · 추억 보관소

| 작업 | 처리 방식 | 설명 |
| --- | --- | --- |
| 기간별 목록 | 테이블 `diaries` 조회 (from~to) | 캘린더·추억 보관소 |
| 특정 날짜 조회 | 테이블 `diaries` 조회 | |
| 작성/수정 | RPC `save_diary` (안) | 없으면 생성, 있으면 수정 + 보상 판정 (한 트랜잭션) |
| 삭제 | 테이블 `diaries` 삭제 | RewardEvent는 유지 |

```json
// 작성/수정 요청 (date: "2026-11-09")
{ "date": "2026-11-09", "mood": "happy", "content": "오늘은...", "linkedNodeId": null }
// 결과 (첫 작성)
{
  "diary": { /* Diary */ },
  "reward": { "rewarded": true, "energy": 10 },
  "pet": { /* Pet (갱신됨) */ }
}
// 결과 (같은 날 재저장)
{ "diary": { /* Diary */ }, "reward": { "rewarded": false }, "pet": { /* Pet */ } }
```
- 일기 작성·수정은 테이블에 직접 쓰지 않고 `save_diary`를 통해서만 한다.
- 미래 날짜 작성 허용 여부 `[미확정]`

### 4.7 펫

| 작업 | 처리 방식 | 설명 |
| --- | --- | --- |
| 내 펫 조회 | 테이블 `pets` 조회 | |

- 에너지 증가는 보상 지급 RPC 함수로만 발생한다. (프론트에서 직접 에너지를 수정하는 방법 없음)

### 4.8 공고 탐색

| 작업 | 처리 방식 | 설명 |
| --- | --- | --- |
| 공고 목록 | `frontend/src/data/`의 정적 샘플 데이터 | MVP는 DB 사용 안 함 |
| 공고 → 보관함 추가 | 테이블 `nodes` 추가 (`source: "explore"`) | (고려 중) |

```json
// 공고 목록
{
  "items": [
    {
      "id": "x_1",
      "category": "contest",
      "title": "○○ 공모전",
      "organizer": "○○기관",
      "deadline": "2026-12-15",
      "url": "https://example.com"
    }
  ]
}
```
- MVP: 정적 샘플 데이터. 카테고리: `contest` | `hackathon` | `internship` | `activity` | `notice`

## 5. RLS(행 수준 보안) 정책

모든 사용자 데이터 테이블에 RLS를 켠다. "본인" = `user_id = auth.uid()` (`profiles`는 `id = auth.uid()`).

| 테이블 | 조회 | 추가 | 수정 | 삭제 |
| --- | --- | --- | --- | --- |
| profiles | 본인 | 가입 시 자동 생성 | 본인 | 불가 |
| timeline_periods | 본인 | RPC로만 | 본인 (이름·타입) | RPC로만 |
| nodes | 본인 | 본인 | 본인 | 본인 |
| edges | 본인 | 본인 | 본인 | 본인 |
| node_documents | 본인 | 본인 | 본인 | 본인 (노드 삭제 시 함께) |
| diaries | 본인 | RPC로만 | RPC로만 | 본인 |
| pets | 본인 | RPC로만 | RPC로만 | 불가 |
| reward_events | 본인 | RPC로만 | 불가 | 불가 |

- "RPC로만" = 프론트가 테이블에 직접 쓰지 못하고, DB 함수 안에서만 바꿀 수 있다.
- 새 테이블을 만들 때는 RLS를 반드시 켜고 이 표에 추가한다.
- `service_role` 키는 RLS를 무시하므로 **프론트엔드 코드·`.env`에 절대 넣지 않는다.**

## 6. 프론트엔드 연동 방식

- 데이터 작업은 `frontend/src/services/api.js`에 모은다. (공용 파일: 수정 전 협의)
- Supabase 연결 설정(클라이언트 생성)은 서비스 계층에 한 곳만 둔다. (파일 이름 `[미확정]`, 공용 파일로 관리)
- 서비스 계층이 snake_case ↔ camelCase 변환과 오류 형식 통일을 맡는다.
- 환경 변수 (프론트 `.env`, 값은 Git에 올리지 않음):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY` (공개용 키. RLS가 보호한다)
- DB가 준비되기 전에는 `frontend/src/data/`의 Mock Data로 같은 형식(camelCase)을 반환한다.
- 데이터 형식이 바뀌면 코드보다 먼저 이 문서를 수정하고 팀에 알린다.

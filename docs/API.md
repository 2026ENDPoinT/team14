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
- `nickname` 중복 허용.
- `grade`: 현재 학년 `1` | `2` | `3` | `4` (학년 단위, 해당 학년 1·2학기 포함). 나중에 변경 가능하며, 변경해도 기존 로드맵을 자동으로 덮어쓰지 않는다.
- `interests`: 온보딩 STEP 4에서 고른 **희망 직무** 키 목록 (예: `"backend"`, `"ai"`)

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
  "originKey": "course:cs2026-2-1-01",
  "completed": false,
  "createdAt": "2026-11-09T12:00:00+09:00"
}
```
- `periodId`: `null`이면 **보관함**에 있는 노드
- `status`: `"placed"`(학기에 배치) | `"stored"`(보관함)
- `theme`: `major` | `project` | `external` | `career` | `research` | `event` | `free` | 사용자 정의 테마 ID
- `source`: `"user"` | `"onboarding"`(STEP 2 경험) | `"completed_course"`(STEP 3에서 고른 **수강한 교과목**) | `"recommended"`(희망 직무에 맞춰 선정된 **미래 학년 교과목**) | `"explore"`
- `originKey`: 온보딩에서 생성된 노드의 중복 생성 방지 키 (없으면 `null`). DB에 `(user_id, origin_key)` 유일 제약을 둔다.
  - 교과목 노드: `course:<과목 키>` (예: `course:cs2026-2-1-01`)
  - 과목 키는 교과과정 데이터의 `key`(4.4, 2026년 교과과정 기준 고유 키)를 쓴다.
  - 직무가 아니라 **과목 기준** 키이므로, 같은 과목은 노드 1개만 생긴다.
- `completed`: 이수 완료 표시 (`true`/`false`). STEP 3에서 사용자가 직접 고른 수강 과목만 `true`로 생성된다. 사용자가 나중에 바꿀 수 있다. (필드 이름 `(안)`)
  - 이수 완료 노드의 `periodId`는 연계도 **권장 학기** 위치이며, 실제 수강 학기를 뜻하지 않는다.
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
- 사용자당 1마리. **온보딩 완료 시** 생성한다. (`stage: 1`, `energy: 0`)
- `type`: 희망 직무(관심 분야)에 따른 외형 키 `[미확정]`
- `energy`: **누적 에너지**. 성장해도 차감하지 않는다.
- `stage`: 1~4. 누적 에너지로 정한다.

| stage | 이름 | 누적 에너지 |
| --- | --- | --- |
| 1 | 알 | 0 이상 |
| 2 | 아기 | 50 이상 |
| 3 | 성장기 | 150 이상 |
| 4 | 성체 | 300 이상 |

- `energyToNextStage`: **다음 단계의 누적 에너지 기준값** (예: 1단계면 `50`). 4단계면 `null`.
- 기준값은 DB 설정값으로 관리하여 쉽게 바꿀 수 있게 한다. (관리 방식 `[미확정]`)
- **프론트에서 직접 수정할 수 없다.** (조회만 가능, 5장)

### RewardEvent (보상 이력, `reward_events`)
```json
{
  "id": "r_1",
  "type": "diary_first_of_day",
  "refId": "2026-11-09",
  "energy": 20,
  "createdAt": "2026-11-09T12:00:00+09:00"
}
```
- `type`: `attendance` | `diary_first_of_day` | `node_reflection` | `semester_reflection`
  - `attendance`: 홈 '출석하기' 버튼 보상
  - `diary_first_of_day`: 서버 기준 오늘, 처음으로 **공백 제외 본문 30자 이상** 일기를 저장(또는 수정)했을 때의 보상 (이름은 기존 것을 유지, 일기의 `date`와 무관)
- `refId`: 출석·일기는 지급 날짜(서버 KST 날짜), 노드 회고는 nodeId, 학기 회고는 periodId
- **프론트에서 직접 추가·수정·삭제할 수 없다.** (조회만 가능, 5장)

## 3. 중복 보상 방지 규칙 (DB 함수에서 판단)

프론트엔드가 아닌 **DB 함수(RPC)가 최종 판단**한다. DB에 `(user_id, type, ref_id)` 유일 제약을 둔다.

| type | refId | 에너지 | 조건 · 한도 |
| --- | --- | --- | --- |
| attendance | 지급 날짜(KST) | +10 | '출석하기' 버튼 요청, 사용자·날짜당 1회 |
| diary_first_of_day | 지급 날짜(KST) | +20 | 공백 제외 본문 30자 이상, 사용자·날짜당 1회 |
| node_reflection | nodeId | +15 (제안값) | 노드당 1회 (P1) |
| semester_reflection | periodId | +30 (제안값) | 학기당 1회 (P1) |

**보상 RPC가 반드시 지킬 것 (원자적 지급)**
1. **인증:** `auth.uid()`로 로그인 사용자를 확인한다. 로그인하지 않았으면 `UNAUTHENTICATED`, 아무것도 바꾸지 않는다.
2. **날짜 계산:** 지급 날짜는 프론트가 보내는 값이 아니라 **서버가 계산한 현재 날짜(Asia/Seoul)** 를 쓴다.
3. **조건 확인:** 일기 보상은 본문에서 공백(띄어쓰기·줄바꿈 등)을 뺀 글자 수가 30자 이상인지 서버에서 다시 센다.
4. **중복 확인 + 지급:** `reward_events`에 `(user_id, type, ref_id)` 행 추가를 시도한다. 이미 있으면 지급하지 않는다.
5. **에너지·단계 갱신:** 새로 추가된 경우에만 `pets.energy`를 늘리고 `stage`를 다시 계산한다. (차감 없음)
- 1~5는 **하나의 트랜잭션**에서 처리한다. 중간에 실패하면 전부 취소된다.
- 같은 요청이 동시에 여러 번 와도 유일 제약 때문에 보상은 한 번만 들어간다.
- **하루 1회:** `attendance`, `diary_first_of_day`는 각각 서버 KST 날짜당 1회만 지급한다.
- 일기 수정·재저장·삭제 후 재작성으로 보상을 다시 받을 수 없다. (삭제해도 RewardEvent는 유지)
- 30자 미만으로 저장한 일기를 수정해 **처음으로 30자 이상**이 되면, 그날 아직 `diary_first_of_day`가 없을 때만 지급한다.
- 일기의 `date` 필드는 보상 날짜를 정하지 않는다. 과거 날짜 일기를 작성·수정해도 **소급 지급하지 않는다.**
- 로그인/접속 자체는 보상 없음. 출석은 '출석하기' 버튼을 눌러야만 지급한다.
- 미접속 페널티 없음. 에너지를 줄이는 기능은 없다.
- 이미 지급된 경우 오류가 아니라 `rewarded: false`로 정상 응답한다.
- 에너지 수치와 단계 기준값의 근거는 SPEC.md 8장.

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
| 내 정보 수정 | 테이블 `profiles` 수정 | 닉네임·학년·희망 직무 |

- 로그인 후 `onboardingCompleted`가 `false`이면 `/onboarding`으로, `true`이면 `/`(홈)으로 이동한다.

### 4.2 온보딩

| 작업 | 처리 방식 | 설명 |
| --- | --- | --- |
| 온보딩 완료 | RPC `complete_onboarding` (안) | 프론트가 선정한 과목 목록을 **검증**한 뒤, 프로필 저장 + 기본 8학기 + 펫 + 경험 노드 + **이수 완료 과목 노드 + 미래 추천 과목 노드**를 한 번에 저장 |

**역할 나누기**
- **과목 선정:** 프론트엔드 JavaScript 함수 (교과과정 데이터는 `frontend/src/data/`, 4.4)
- **검증·저장:** Supabase RPC (트랜잭션, 로그인 사용자 확인, 중복 호출 안전)

```json
// 요청 (grade만 필수, 나머지는 건너뛰기 가능)
{
  "nickname": "민수",
  "grade": 2,
  "experiences": ["hackathon", "club"],
  "completedCourses": ["cs2026-1-1-01"],
  "interests": ["backend"],
  "roadmapMode": "auto",
  "courseNodes": [
    { "courseKey": "cs2026-1-1-01", "title": "<과목명>", "year": 1, "semester": 1, "completed": true },
    { "courseKey": "cs2026-3-1-01", "title": "<과목명>", "year": 3, "semester": 1, "completed": false }
  ]
}
// grade: 현재 학년 1~4 (필수)
// completedCourses: STEP 3에서 사용자가 직접 고른 "실제로 수강한 과목"의 과목 키 목록 (1~4학년 전체 과목 중에서 선택)
// interests: 희망 직무 키 목록 (비어 있거나 "undecided"면 미래 학년 전공필수 과목만 선정)
// roadmapMode: 미래 추천 과목의 초기 배치 방식 (이수 완료 과목에는 적용 안 됨, 기본값 "auto")
//   "auto"  = 연계도의 권장 학기에 바로 배치
//   "inbox" = 보관함에 추가 (학기 영역은 비워 둠)
// courseNodes: 프론트 선정 함수의 결과 (4.4 선정 규칙). 이수 완료 과목 + 미래 추천 과목
//   year·semester = 연계도의 권장 학년·학기 (실제 수강 학기 아님)
// ※ 과목 키 형식은 4.4 "과목 키 규칙"
// 성공
{ "user": { /* User */ }, "nodes": [ /* Node[] */ ], "periods": [ /* TimelinePeriod[] */ ], "pet": { /* Pet */ } }
```
- `grade`가 없거나 1~4가 아니면 `VALIDATION_ERROR`
- 학년만 고르고 나머지를 건너뛰어도 기본 8학기와 펫을 만든다. 미래 과목은 미래 학년 전공필수 과목만 선정된다.
- `roadmapMode` 기본값은 `"auto"`. (값이 없으면 auto로 처리)
- 노드 생성 규칙:

| 대상 | source | 배치 | completed |
| --- | --- | --- | --- |
| STEP 2 경험 (`experiences`) | `onboarding` | 항상 보관함 (`stored`) | - |
| STEP 3 이수 완료 과목 (`courseNodes` 중 `completed: true`) | `completed_course` | 항상 연계도의 권장 학기 (`placed`), `roadmapMode` 무관 | `true` |
| 미래 추천 과목 (`courseNodes` 중 `completed: false`) | `recommended` | `auto` → 권장 학기 (`placed`) / `inbox` → 보관함 (`stored`, `periodId: null`) | `false` |

- 교과목 노드는 모두 `theme: "major"`, `originKey: "course:<과목 키>"`
- 권장 학기 → 기본 8학기 위치: `order = (year - 1) × 2 + (semester - 1)` (1-1 → 0, 4-2 → 7)
- 이수 완료 과목의 `periodId`는 **권장 학기 위치일 뿐, 실제 수강 학기를 뜻하지 않는다.** 실제 수강 학기 필드는 두지 않는다. (입력 기능은 MVP에서 제외)
- 고르지 않은 과목은 이수 완료로 처리하지 않는다.

**RPC 검증 항목 (MVP)**
1. **사용자 인증:** 로그인 사용자 본인인지, 이미 온보딩을 완료했는지 (완료했으면 `CONFLICT`)
2. **학기 범위:** `grade`가 1~4, `courseNodes`의 `year`가 1~4·`semester`가 1~2인지, `completed: false`인 과목은 `year > grade`인지 (미래 학년만 추천)
3. **데이터 형식:** 필드 타입, `courseKey`·`title`이 비어 있지 않은지, `roadmapMode`가 `"auto"` 또는 `"inbox"`인지
4. **중복 노드:** `courseNodes` 안에 같은 `courseKey`가 없는지 (DB에도 `(user_id, origin_key)` 유일 제약)
5. **일치 여부:** `completed: true`인 과목 키 목록과 `completedCourses`가 정확히 같은지
- 실패하면 아무것도 저장하지 않고 `VALIDATION_ERROR`를 돌려준다.
- `courseKey`가 **공식 과목 목록(연계도)에 실제로 있는지 서버에서 대조하는 검증은 후순위**로 둔다. (교과과정 데이터가 프론트에만 있으므로 MVP에서는 하지 않음)
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

### 4.4 교과과정 데이터 · 교과목 선정

- 별도의 추천 화면·추천 API는 없다. 교과목 노드는 **온보딩 완료(4.2) 때 함께 생성**된다.
- 선정 대상은 **서울과기대 학교 교과목**뿐이다. 직무별 기술 학습 노드는 만들지 않는다.
- 기준 자료: **2026 컴퓨터공학과 교과과정 연계도** (1-1 ~ 4-2, 8학기)
  - 원본 이미지: `docs/references/curriculum-2026.png`
  - 과목명·권장 학년·학기·전공필수 여부 등 **연계도에 표시된 정보만** 넣는다.
  - 연계도에 없는 학점, 공식 선수과목, 개설 정보는 넣지 않는다.
  - 확실히 읽을 수 없는 칸은 추측하지 않고 `"needsCheck": true`로 표시한다.
- 연계도 원본에서 확인한 점 (데이터 작성 시 참고)
  - 과목코드가 표시되어 있지 않다. → 아래 **2026년 교과과정 기준 고유 키**를 쓴다.
  - 전공필수 교과목은 빨간 글씨로 표시되어 있다.
  - 과목이 영역별 줄(왼쪽 세로 표기)로 나뉘어 있다.
  - 한 칸에 이름이 두 줄 이상 적힌 경우, 하나의 과목인지 확인이 필요하다. (`needsCheck`)
- 데이터 위치: `frontend/src/data/` (파일 이름 `(안)`: `curriculum-2026.json`, `job-relevance.json`)
- **공식 정보와 팀 판단을 다른 파일로 나눈다.**
  - `curriculum-2026.json`: 연계도에 표시된 **공식 정보만**
  - `job-relevance.json`: 직무 관련도 점수 = **팀 자체 판단**

#### 과목 키 규칙
- 형식: `cs2026-<학년>-<학기>-<번호>` (예: `cs2026-2-1-01`)
  - `<번호>`: 연계도의 해당 학기 열에서 위→아래 순서, 두 자리 (`01`부터)
- 한 번 정한 키는 바꾸지 않는다. (사용자 노드의 `originKey`가 이 키를 쓰기 때문)
- 같은 과목명이 여러 위치에 있으면 **임의로 합치지 않는다.** 위치마다 키를 따로 두고 `needsCheck: true`로 표시한 뒤, 같은 과목으로 확인되면 합친다.
- 노드의 `originKey` = `course:<과목 키>` (예: `course:cs2026-2-1-01`)

#### 교과과정 데이터 형식 — `curriculum-2026.json` (공식 정보)
```json
{
  "source": { "name": "2026 컴퓨터공학과 교과과정 연계도", "year": 2026, "file": "docs/references/curriculum-2026.png" },
  "courses": [
    { "key": "cs2026-2-1-01", "title": "<과목명>", "year": 2, "semester": 1, "category": null, "area": "<연계도 영역>", "needsCheck": false }
  ]
}
```
- `year`·`semester`: 연계도상 **권장** 학년·학기 → 이수 완료 과목 배치, `auto` 배치에 사용
- `category`: 연계도에 전공필수로 표시(빨간 글씨)되면 `"전공필수"`, 아니면 `null`
- `area`: 연계도의 영역 표기. 표시가 불확실하면 `needsCheck: true`
- `needsCheck`: 연계도에서 확실히 읽을 수 없거나 같은 과목인지 확인이 필요한 경우 `true`
- 같은 `key`는 한 번만 나온다. (중복 방지)
- 학점·선수과목·개설 정보 필드는 두지 않는다. (연계도에 없음)

#### 직무 관련도 데이터 형식 — `job-relevance.json` (팀 판단)
```json
{
  "basis": "team",
  "curriculumYear": 2026,
  "minScore": 2,
  "jobs": {
    "backend": { "cs2026-2-1-01": 3, "cs2026-2-2-01": 2 },
    "ai": { "cs2026-3-2-01": 3 }
  }
}
```
- `basis: "team"`: 공식 교과과정 정보가 아니라 **팀 자체 판단**임을 표시한다.
- 점수: `0` 관련 없음 · `1` 간접 관련 · `2` 관련 있음 · `3` 핵심 과목
- 목록에 없는 과목은 `0`점으로 본다.
- `minScore`: 이 점수 이상인 과목을 선정한다. **MVP 확정값 `2`**
- 직무를 여러 개 고르면 과목마다 **가장 높은 관련도 점수**를 쓴다.
- 관련도 점수는 **학교 공식 평가가 아니라 팀 자체 판단**이다. 화면에 보여줄 때도 공식 정보처럼 표시하지 않는다.
- 직무 키는 온보딩 STEP 4 선택지 키와 같게 맞춘다. "아직 정하지 않음"(`undecided`)은 넣지 않는다.

#### 선정 규칙 (프론트 JavaScript 함수)
1. **이수 완료 과목:** `completedCourses`에 있는 과목(1~4학년 전체 중 사용자가 선택) → 권장 학기, `completed: true`
2. **미래 추천 과목:** `year > grade`인 과목 중
   - 직무를 골랐으면: 선택한 직무들 중 **가장 높은 관련도 점수**가 `minScore` 이상인 과목
   - 직무를 안 골랐거나 "아직 정하지 않음"뿐이면: `category: "전공필수"`인 과목만
   - **이수 완료 과목은 제외**한다.
   - → `completed: false`, `roadmapMode`에 따라 배치
3. 그 밖의 과목(고르지 않은 과목, `year <= grade`인 미선택 과목)은 노드를 만들지 않는다.
- 결과는 `courseNodes`로 RPC에 보낸다. (4.2)
- 이미 존재하는 `originKey`는 건너뛰어 중복 생성하지 않는다. (`(user_id, origin_key)` 유일 제약)

#### 선정 함수 입력·출력 (안)
```js
// 위치(안): frontend/src/features/onboarding/selectCourses.js
selectCourses({
  grade: 2,                                   // 필수, 1~4
  completedCourseKeys: ["cs2026-1-1-01"],     // STEP 3 선택
  jobs: ["backend"],                          // STEP 4 선택 ([] 또는 ["undecided"] 가능)
  curriculum,                                 // curriculum-2026.json
  jobRelevance,                               // job-relevance.json
})
// 반환
{
  courseNodes: [
    { courseKey: "cs2026-1-1-01", title: "<과목명>", year: 1, semester: 1, completed: true },
    { courseKey: "cs2026-3-1-01", title: "<과목명>", year: 3, semester: 1, completed: false }
  ]
}
```
- `courseNodes`는 4.2 요청에 그대로 넣는다. `roadmapMode`는 함수가 아니라 요청에서 따로 보낸다.
- 커리큘럼에 없는 과목 키가 `completedCourseKeys`에 있으면 무시한다.
- 같은 입력이면 항상 같은 결과를 돌려준다. (화면·DB에 접근하지 않는 순수 함수)

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
| 작성/수정 | RPC `save_diary` (안) | 없으면 생성, 있으면 수정 + 일기 보상 판정 (한 트랜잭션, 3장) |
| 삭제 | 테이블 `diaries` 삭제 | RewardEvent는 유지 |

```json
// 작성/수정 요청 (date: "2026-11-09")
{ "date": "2026-11-09", "mood": "happy", "content": "오늘은...", "linkedNodeId": null }
// 결과 (서버 기준 오늘 처음으로 공백 제외 30자 이상 저장 또는 수정)
{
  "diary": { /* Diary */ },
  "reward": { "rewarded": true, "energy": 20 },
  "pet": { /* Pet (갱신됨) */ }
}
// 결과 (오늘 이미 일기 보상을 받음 / 30자 미만)
{ "diary": { /* Diary */ }, "reward": { "rewarded": false }, "pet": { /* Pet */ } }
```
- 일기 작성·수정은 테이블에 직접 쓰지 않고 `save_diary`를 통해서만 한다.
- 일기는 **글자 수와 관계없이 저장된다.** 30자 미만이면 보상만 지급하지 않는다.
- 나중에 수정해 처음으로 30자 이상이 되면, 그날 아직 일기 보상을 받지 않았을 때 지급한다.
- 보상 날짜는 요청의 `date`가 아니라 **서버가 계산한 오늘(Asia/Seoul) 날짜**다. 과거 날짜 일기를 작성·수정해도 소급 지급하지 않으며, 여러 개 써도 하루 1회다.
- 미래 날짜 작성 허용 여부 `[미확정]`

### 4.7 펫

| 작업 | 처리 방식 | 설명 |
| --- | --- | --- |
| 내 펫 조회 | 테이블 `pets` 조회 | |
| 출석하기 | RPC **`check_in`** | 홈 '출석하기' 버튼. 서버 KST 날짜 기준 하루 1회 +10, 중복 지급은 서버에서 방지 (한 트랜잭션, 3장) |
| 오늘 출석 여부 조회 | 테이블 `reward_events` 조회 (`type: "attendance"`, 오늘 KST 날짜) | 버튼 완료 상태 표시용 |

```json
// 출석하기 요청 (보낼 값 없음. 날짜는 서버가 정함)
{}
// 결과 (오늘 첫 출석)
{ "reward": { "rewarded": true, "energy": 10 }, "pet": { /* Pet (갱신됨) */ } }
// 결과 (오늘 이미 출석)
{ "reward": { "rewarded": false }, "pet": { /* Pet */ } }
```
- 에너지 증가는 보상 지급 RPC 함수(`check_in`, `save_diary`, 회고 보상)로만 발생한다. (프론트에서 직접 에너지를 수정하는 방법 없음)
- 로그인만으로는 `check_in`이 호출되지 않는다. 사용자가 버튼을 눌렀을 때만 호출한다.

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

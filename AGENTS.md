# AGENTS.md — AI 코딩 도구 협업 규칙

이 저장소에서 작업하는 AI 코딩 도구(Codex, Claude Code 등)는 아래 규칙을 따른다.
사용자는 개발 초급자이므로 쉽게 설명하고, 확인 방법을 함께 알려준다.

## 1. 작업 시작 전

1. `SPEC.md`를 먼저 읽는다. `[미확정]` 항목은 임의로 정하지 않고 사용자에게 묻는다.
2. 데이터를 주고받는 코드는 `docs/API.md`의 형식을 따른다.
3. `TASKS.md`에서 이번 작업의 담당 파일 범위를 확인한다.
4. 현재 브랜치를 확인한다. **`main`에서 직접 작업하지 않는다.**
   - 브랜치: `feature/roadmap`, `feature/pet-diary`, `feature/backend`, `feature/onboarding`

## 2. 수정 범위

- 요청받은 기능만 구현한다. 확정되지 않은 기능을 추가하지 않는다.
- **요청하지 않은 파일은 수정하지 않는다.** 기존 기능을 임의로 삭제·변경하지 않는다.
- 한 번에 한 기능만 작업한다. ("로드맵 전체 구현" 같은 요청은 작은 단위로 나눠 제안한다.)
- 자신의 담당 영역 밖 파일을 바꿔야 하면 **수정하기 전에 사용자에게 알리고 협의를 요청한다.**
- 기존 폴더/파일을 삭제하거나 덮어쓰지 않는다. 새 파일을 만들기 전에 기존 구조와 충돌하는지 확인한다.

### 담당 영역

| 담당 | 영역 |
| --- | --- |
| 1번 | `frontend/src/pages/RoadmapPage.jsx`, `frontend/src/features/roadmap/`, 프론트 라우팅·통합 |
| 2번 | `HomePage.jsx`, `DiaryPage.jsx`, `MemoriesPage.jsx`, `features/pet/`, `features/diary/`, `styles/` |
| 3번 | `supabase/migrations/` (테이블·RLS·DB 함수), `docs/API.md` (기술 관리), `backend/` (MVP 미사용, 유지만) |
| 4번 | `LoginPage.jsx`, `OnboardingPage.jsx`, `ExplorePage.jsx`, `features/onboarding/`, `frontend/src/data/` |

### 공용 파일 (수정 전 반드시 협의)

```
frontend/src/App.jsx
frontend/package.json
frontend/src/services/api.js
frontend/src/services/ 의 Supabase 연결 파일 (파일 이름 미확정)
frontend/src/styles/tokens.css
supabase/migrations/
docs/API.md
SPEC.md
AGENTS.md
```

## 3. 기획 유지 사항

- 제거된 기능을 되살리지 않는다: **주간 계획표, 독립 아티클 페이지**
- 홈 화면은 펫 중심이다.
- 보상은 DB 함수(RPC)에서 중복 판정한다. (`docs/API.md` 3장) 펫 에너지·보상 이력을 프론트에서 직접 수정하는 코드를 만들지 않는다.
- MVP에서는 Node 서버를 사용하지 않는다. `backend/` 폴더는 삭제하지 않는다.
- 학기 삭제 시 노드·문서는 지우지 않고 보관함으로 이동한다.
- 일반 활동(동아리·해커톤·군 복무 등)은 자동 배치하지 않는다.
- 사용자 간 비교·순위 기능을 만들지 않는다.

## 4. 개발 방식

- 프론트엔드는 API가 없으면 `frontend/src/data/`의 **Mock Data**로 먼저 만든다. 형식은 `API.md`와 같게 한다.
- API는 하나씩 연결한다.
- 컴포넌트는 Supabase를 직접 호출하지 않고 `frontend/src/services/`의 함수만 사용한다.
- 이름 규칙: DB 컬럼은 snake_case, React 코드는 camelCase. 변환은 서비스 계층에서만 한다.
- 스타일은 일반 CSS로 작성하고, 색상·폰트·간격은 `tokens.css`의 값을 사용한다.
- DB 변경(테이블·RLS·함수)은 `supabase/migrations/`에 **새 SQL 파일로 추가**한다. 이미 적용된 SQL 파일은 고치지 않는다.
- 코드는 초급자가 읽을 수 있게 간결하게 작성하고, 필요한 곳에만 짧은 주석을 단다.
- 새 패키지 설치가 필요하면 설치 전에 이유를 알리고 승인받는다.

## 5. 보안

- API 키, 비밀번호, 토큰 등 비밀값을 코드에 직접 쓰지 않는다.
- 비밀값은 `.env`에 두고 `.env`는 Git에 올리지 않는다. 예시는 `.env.example`에 값 없이 적는다.
- 로그인한 사용자의 데이터만 접근하도록 **RLS 정책**으로 확인한다. 새 테이블은 RLS를 반드시 켠다. (`docs/API.md` 5장)
- DB 함수(RPC)는 함수 안에서 `auth.uid()`로 로그인 사용자를 확인한다.
- 프론트 `.env`에는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`만 둔다.
- **`service_role` 키는 프론트엔드 코드·`.env`·Git에 절대 넣지 않는다.**

## 6. 작업 후 보고 (필수)

작업이 끝나면 다음을 보고한다.

1. **변경한 파일 목록** (새로 만든 것 / 수정한 것 구분)
2. 구현한 내용 요약
3. **직접 확인하는 방법** (실행 명령어, 실행 위치, 확인할 화면)
4. 실제로 실행해 테스트한 결과. 실행하지 않았다면 "실행하지 않음"이라고 명시한다.
5. 남은 문제와 `[미확정]`으로 남긴 부분

실행해서 확인하기 전에는 "완료되었다"고 단정하지 않는다.

## 7. Git

- 작업은 자신의 feature 브랜치에서 한다.
- 커밋 메시지 예: `feat: 일기 작성 화면 추가`, `fix: 노드 위치 저장 오류 수정`
- 작업이 끝나면 Pull Request를 만들고 검토 후 `main`에 병합한다.
- `git push --force`, 다른 사람 브랜치 수정은 하지 않는다.

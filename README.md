# team14
ENDPoinT 해커톤 2026 Team 14

## momentree (모멘트리)

> 대학생활을 **계획**(로드맵)하고, **기록**(일기·추억)하며, **성장**(펫)을 확인하는 개인 성장 웹 서비스
> 이름: Moment + Tree — 작은 순간들이 모여 나만의 길(나무)이 된다

- 대상: 서울과학기술대학교 컴퓨터공학과 학생 
- 개발 조건: 4명, 약 7일 해커톤, 목표는 **시연 가능한 MVP**

> **현재 상태: MVP 구현 진행 중** (2026-11-14 기준)
> 아래 기능은 코드로 구현되어 있습니다. 일부 기능은 **DB migration 적용·Edge Function 배포가 끝나야** 실제 서버에서 동작합니다. → [6-1. DB·배포 상태](#6-1-db배포-상태)

---

## 1. 왜 만드나요?

### 해결하려는 문제

**대학생활에서 자신의 미래를 계획하고, 기회를 탐색하며, 경험을 쌓아가는 과정에서 발생하는 어려움**

1. **대학생활의 방향 설정과 미래에 대한 불안**
   - 진로와 앞으로의 계획이 명확하지 않은 상황에서 무엇부터 준비해야 할지 판단하기 어렵고, 다른 사람과 자신의 스펙을 비교하며 조급함을 느끼기도 함.

2. **학업과 비교과 활동 탐색의 부담**
   - 학업과 병행하며 자신에게 맞는 공모전, 대외활동, 인턴십 등의 정보를 탐색하고 준비하는 데 시간적 부담이 존재함.

3. **기회 탐색과 실제 실행 계획의 단절**
   - 관심 있는 활동을 발견하더라도 이를 장기적인 대학생활 계획에 반영하고 체계적으로 관리하기 위해 추가적인 노력이 필요함.

4. **경험과 성장 과정의 기록 부족**
   - 교과목, 프로젝트, 대외활동에서 얻은 경험과 배운 점이 흩어져 있어 시간이 지난 뒤 자신의 성장 과정을 돌아보거나 활용하기 어려움.

5. **꾸준한 실천과 자기 성장에 집중하기 어려움**
   - 장기적인 계획을 지속적으로 관리하고 기록하기 쉽지 않으며, 외부의 평가나 타인과의 비교보다 자신의 목표와 역량 개발에 집중할 수 있는 동기부여가 필요함.

### 서비스가 제공하려는 가치

**타인과의 경쟁보다 나 자신의 성장에 집중하는 대학생활**

공고 탐색부터 개인별 로드맵 구성, 활동 실행과 경험 기록까지 하나의 흐름으로 연결하고, 자신의 계획과 성취를 시각적으로 확인할 수 있도록 지원한다. 또한 펫 성장 시스템을 통해 꾸준한 실천과 기록을 유도하고, 사용자가 자신만의 속도로 대학생활을 설계할 수 있도록 돕는다.

### 핵심 목적
- 다른 사람과 비교하지 않고 **나만의 성장 기록**을 남긴다. (순위·경쟁 기능 없음)
- 펫 성장은 실력을 증명하는 점수가 아니라, 꾸준히 기록하고 출석하도록 돕는 장치다.

### 핵심 흐름
학년·경험·수강 과목·희망 직무(또는 미정) 선택 → 함께할 펫 만나기 → 교과과정 연계도 기반 로드맵 생성 → 대학생활 계획·수정 → 일기·활동 기록 → 온기 획득 → 펫 성장 → 추억 축적

---

## 2. 주요 기능

| 기능 | 설명 | 페이지 |
| --- | --- | --- |
| 🌱 **서비스 소개** | 비로그인 방문자의 첫 화면. 스크롤 스토리텔링 랜딩 | `/welcome` |
| 🔐 **로그인** | 이메일·비밀번호, Google 로그인, 비밀번호 재설정. 내 데이터만 보임(RLS) | `/login`, `/reset-password` |
| 🧭 **온보딩** | 프로필(닉네임·학년) → 경험 → 수강 과목 → (선택) AI 진로 추천 → 희망 직무 1개 또는 '아직 정하지 않음' → **함께할 펫**. 직무를 고르면 직무별 펫을 자동 배정, 미정이면 5종(펭귄·수달·검은 고양이·햄스터·토끼) 중 직접 선택. 완료 시 2026 교과과정 연계도 기반 기본 로드맵 생성 | `/onboarding` |
| 🐣 **펫 홈** | 펫 중심 HOME. 자동 출석(하루 1회 +100 온기), 성장 점, 랜덤 한마디, 닉네임 변경, 펫 반응 애니메이션, 오래 못 본 펫(3일·7일) 연출, 처음 방문 튜토리얼 | `/` |
| 🗺️ **가로형 로드맵** | 학기 타임라인 위 교과목·활동 노드, 드래그 이동·자리 교환, 끌어다 놓아 관계선 연결, 노드 상세(기록·마감일·링크·파일·사진), 노드 보관함, 학기·기간 추가·삭제(노드는 보관함으로), 학기 자동 확장, **메모 노드**(글래스 카드·크기·글씨 크기 조절), 진로 목표 노드, '수강 필요' 안내, **AI 진로 길잡이**, 튜토리얼 | `/roadmap` |
| 🗂️ **추억보관소** | 일기 달력 + '오늘의 이야기'(사적인 기록)·'오늘의 발자취'(공부·활동 기록), 사진, **AI 회고 질문**(발자취 기준), **AI 타임캡슐**, 주요 활동 모음 | `/memories` (`/diary`도 같은 화면) |
| 📢 **기회 탐색** | 대외활동(학교 게시판 자동 수집)·채용(고용24)·기술 뉴스(Hacker News). 공고를 고른 학기에 바로 노드로 추가 | `/explore` |
| 👤 **마이페이지** | 프로필 편집(희망 직무), 화면 설정(다크 모드, 이 브라우저에 저장), 내 활동·기록 관리, 회원 탈퇴 | `/mypage` |

자세한 기능 명세는 [SPEC.md](SPEC.md)를 보세요.

---

## 3. 기술 스택

| 구분 | 사용 기술 |
| --- | --- |
| 프론트엔드 | React + Vite, React Router, React Flow (`@xyflow/react`) |
| 스타일 | 일반 CSS (화면별 CSS 파일 + 다크 모드 `styles/theme.css`). `tokens.css`는 아직 만들지 않음 |
| DB | Supabase PostgreSQL |
| 인증 | Supabase Auth (이메일, Google) |
| 연결 방식 | 프론트엔드에서 Supabase SDK로 직접 연결 (`frontend/src/services/`) |
| 보안 | 모든 사용자 데이터에 RLS(행 수준 보안) 적용 |
| 서버 로직 | 여러 데이터를 함께 바꾸는 작업·보상 지급은 PostgreSQL 함수(RPC) |
| 서버 함수 | Supabase Edge Functions (Deno): AI(Gemini)·공고 수집·회원 탈퇴 |
| 파일 | Supabase Storage (비공개 버킷 `photos`, `attachments`) |
| AI | Google Gemini (Edge Function `recommend-career` 안에서만 호출, 키는 Supabase secrets) |

- Node.js 서버(`backend/`)는 **MVP에서 사용하지 않습니다.** 폴더는 나중을 위해 유지합니다.

---

## 4. 폴더 구조

```
campus-roadmap/
├── README.md            프로젝트 소개 (이 문서)
├── SPEC.md              기능 명세 — 무엇을 만드는지
├── TASKS.md             작업 분담·진행 현황
├── AGENTS.md            AI 코딩 도구·협업 규칙
├── docs/
│   ├── API.md           데이터 형식, Supabase 테이블·RLS·RPC·Edge Function 규격
│   ├── ai-guide.md      AI 진로 길잡이 서버 요청·응답
│   ├── backend-pet-home.md / backend-diary-reward.md  펫 HOME·일기 보상 서버 작업 기록
│   └── references/      디자인 참고 자료
├── frontend/src/
│   ├── pages/           페이지 화면 (Home, Roadmap, Memories, Explore, MyPage, Onboarding, Login, Landing …)
│   ├── features/        기능별 컴포넌트 (roadmap/, home/, pet/, diary/, onboarding/, explore/, career/, landing/ …)
│   ├── components/      공통 컴포넌트 (상단 메뉴 등)
│   ├── services/        Supabase 연결·데이터 처리 (공통 서비스 계층)
│   ├── data/            교과과정·직무 관련도 데이터, Mock Data
│   ├── assets/pets/     펫 이미지 (투명 PNG)
│   └── styles/          공통 스타일 (theme.css: 다크 모드)
├── supabase/
│   ├── migrations/      DB 변경 SQL (테이블·RLS·RPC)
│   └── functions/       Edge Functions (recommend-career, delete-account, sync-*)
└── backend/src/         Node 서버 (MVP 미사용, 구조만 유지)
```

- 빈 폴더에 있는 `.gitkeep`은 폴더를 GitHub에 남기기 위한 빈 파일입니다. 지우지 마세요.
- Supabase SQL 변경 이력은 `supabase/migrations/`, Edge Function 코드는 `supabase/functions/`에 있습니다.

---

## 5. 역할 분담

| 담당 | 브랜치 | 맡은 일 | 주요 파일 |
| --- | --- | --- | --- |
| 1번 (프론트 총괄) | `feature/roadmap` | 피그마 기반 디자인 시스템·공통 컴포넌트, 가로형 로드맵(노드·보관함·상세 문서), 전체 UI 통합 | `styles/`, `RoadmapPage.jsx`, `features/roadmap/`, 라우팅 |
| 2번 (프론트 보조) | `feature/pet-diary` | 홈(출석하기 버튼), 일기, 펫, 추억 보관소 / 여유 시 로그인 UI 지원 | `HomePage.jsx`, `DiaryPage.jsx`, `MemoriesPage.jsx`, `features/pet/`, `features/diary/` |
| 3번 (백엔드 총괄) | `feature/backend` | Supabase, DB, 인증 연동, RLS, 온보딩 저장 RPC, 출석·일기 보상 RPC, 공통 서비스 함수, API 문서 | `supabase/migrations/`, `services/`, `docs/API.md`, `backend/` |
| 4번 (교과과정·온보딩) | `feature/onboarding` | 교과과정 데이터, 직무 관련도, 과목 선정 함수 → 온보딩 UI (1번 공통 디자인 사용) | `data/`, `features/onboarding/`, `OnboardingPage.jsx` |

- 로그인 화면(`LoginPage.jsx`): 2번이 UI를 지원하고, 3번이 인증 연동을 책임집니다.
- 공고 탐색(`ExplorePage.jsx`)은 MVP 필수 범위 밖이라 4번이 여유 있을 때 진행합니다.

작업 목록은 [TASKS.md](TASKS.md)를 보세요.

---

## 6. 설치 및 실행

```bash
cd frontend
npm install
cp .env.example .env      # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 값을 채운다
npm run dev               # http://localhost:5173
npm run build             # 빌드 확인
```

미리 알아둘 점:
- 비밀값은 `.env` 파일에 두고 **Git에 올리지 않습니다.** (`.gitignore`에 등록됨)
- 프론트 `.env`에는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`만 둡니다.
- **`service_role` 키는 절대 프론트 코드나 Git에 넣지 않습니다.**

### 6-1. DB·배포 상태

코드에 있는 것과 실제 Supabase에 적용·배포된 것은 다를 수 있습니다. (2026-11-14, 공개 키로 읽기만 해서 확인)

| 항목 | 코드 | 실제 서버 |
| --- | --- | --- |
| migration `20261109000100` ~ `20261114002600_diary_footprint` | 있음 | 적용됨 |
| migration `20261114002700_choose_pet` + `20261114002800_choose_pet_during_onboarding` (온보딩 중 펫 저장) | 있음 | **미적용** → 적용 전에는 직무 미정 사용자가 온보딩 마지막 화면에서 넘어가지 못함 |
| migration `20261114002900_footprint_reward` (발자취 온기 +100) | 있음 | **확인 못 함** (기존 함수와 이름·인자가 같아 외부에서 구분 불가) |
| migration `20261114003000_tutorial_seen` (튜토리얼 첫 실행 기록) | 있음 | **미적용** → 적용 전에는 튜토리얼이 자동으로 뜨지 않음(? 버튼은 동작) |
| migration `20261114003100_delete_timeline_period` (학기 삭제) | 있음 | **미적용** → 적용 전에는 학기 삭제가 '서버 준비 중' 안내만 함 |
| Edge Function `recommend-career` (온보딩 추천·AI 길잡이) | 있음 | 배포됨 |
| 같은 함수의 `reflect`·`timecapsule` 모드 (AI 회고·타임캡슐) | 있음 | **배포 여부 미확인** (재배포 필요, 배포 전에는 "서버에 배포되지 않았어요" 안내) |
| Edge Function `delete-account` | 있음 | 배포됨 |

---

## 7. Git 협업 방법

### 기본 원칙
- **`main`에서 직접 개발하지 않습니다.** 각자 자기 브랜치에서 작업합니다.
- `main`에는 **Pull Request(PR)로만** 합칩니다.
- `git push --force`는 사용하지 않습니다.
- 다른 사람의 브랜치를 수정하지 않습니다.

### ① 처음 한 번: 프로젝트 받기 (clone)
```bash
cd ~                       # 프로젝트를 둘 위치로 이동 (예: 홈 폴더)
git clone https://github.com/2026ENDPoinT/team14.git
cd team14
```

### ② 내 담당 브랜치로 이동하기
```bash
git switch feature/roadmap      # 1번
git switch feature/pet-diary    # 2번
git switch feature/backend      # 3번
git switch feature/onboarding   # 4번
```
- 자기 브랜치 하나만 입력하세요.
- `git branch`를 실행해 `*` 표시가 내 브랜치 옆에 있는지 확인합니다.

### ③ 작업 전에 최신 `main` 반영하기 (매일 작업 시작할 때)
```bash
git switch feature/내브랜치       # 내 브랜치에 있는지 확인
git pull origin main             # 다른 팀원이 main에 합친 내용 가져오기
```
- 충돌(conflict)이 나면 혼자 해결하려 하지 말고, 해당 파일 담당자와 같이 확인하세요.

### ④ 작업 내용 저장(commit)하고 올리기(push)
```bash
git status                       # 바뀐 파일 확인 (내 담당 파일만 바뀌었는지 꼭 확인!)
git add 바꾼파일경로              # 예: git add frontend/src/pages/RoadmapPage.jsx
git commit -m "feat: 학기 컨테이너 표시"
git push origin feature/내브랜치
```
- 커밋 메시지 예: `feat: 일기 작성 화면 추가`, `fix: 노드 위치 저장 오류 수정`, `docs: API 문서 수정`
- `git add .`(전체 추가)보다 **파일을 하나씩 지정**하는 편이 안전합니다.

### ⑤ Pull Request로 `main`에 합치기
1. GitHub 저장소 페이지 → **Pull requests** → **New pull request**
2. `base: main` ← `compare: feature/내브랜치` 선택
3. 제목과 내용 작성: 무엇을 바꿨는지, 어떻게 확인했는지
4. **Create pull request** → 팀원 1명 이상 확인 후 **Merge**
5. 합친 뒤에는 각자 ③번(`git pull origin main`)으로 최신 내용을 받습니다.

### ⑥ 다른 팀원의 파일은 함부로 수정하지 않기
- 위 [5. 역할 분담](#5-역할-분담)의 내 담당 파일만 수정합니다.
- 다른 사람 파일을 바꿔야 하면 **먼저 담당자에게 말하고** 합의한 다음 수정합니다.

### ⑦ 공용 파일은 수정 전에 반드시 협의하기
아래 파일은 모두에게 영향을 주므로, 수정하기 전에 팀 채팅에 먼저 알리고 합의합니다.
```
frontend/src/App.jsx
frontend/package.json
frontend/src/services/api.js
frontend/src/services/ 의 Supabase 연결 파일
frontend/src/styles/tokens.css
supabase/migrations/
docs/API.md
SPEC.md
AGENTS.md
```
- 새 패키지를 설치(`npm install ...`)할 때도 먼저 팀의 승인을 받습니다.

---

## 8. 참고 문서

| 문서 | 내용 |
| --- | --- |
| [SPEC.md](SPEC.md) | 기능 명세, 확정·미확정 사항 |
| [TASKS.md](TASKS.md) | 작업 분담, 우선순위, 진행 현황 |
| [AGENTS.md](AGENTS.md) | AI 코딩 도구 사용 규칙, 담당 영역, 보안 규칙 |
| [docs/API.md](docs/API.md) | 데이터 형식, Supabase 테이블·RLS·RPC·Edge Function |
| [docs/ai-guide.md](docs/ai-guide.md) | AI 진로 길잡이 서버 요청·응답 |
| [docs/backend-pet-home.md](docs/backend-pet-home.md) | 펫 HOME·출석·닉네임 서버 작업 기록 |
| [docs/backend-diary-reward.md](docs/backend-diary-reward.md) | 일기 온기 보상 서버 작업 기록 |
| [roadmap-reference.png](docs/references/roadmap-reference.png) | 로드맵 UI 참고 이미지 |

> 문서에서 `[미확정]`으로 표시된 내용은 아직 결정되지 않은 것입니다. 임의로 정하지 말고 팀에서 결정합니다.

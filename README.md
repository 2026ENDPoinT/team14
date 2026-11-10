# team14
ENDPoinT 해커톤 2026 Team 14

## Campus Roadmap (가칭)

> 대학생활을 **계획**(로드맵)하고, **기록**(일기·추억)하며, **성장**(펫)을 확인하는 개인 성장 웹 서비스

- 대상: 서울과학기술대학교 컴퓨터공학과 학생 
- 개발 조건: 4명, 약 7일 해커톤, 목표는 **시연 가능한 MVP**
- 서비스명은 아직 가칭입니다.

> ⚠️ **현재 상태: 기획 완료, 개발 시작 전**
> 아래 기능은 모두 **개발 예정**입니다. 지금 저장소에는 기획 문서와 빈 파일·폴더 구조만 있습니다.

---

## 1. 왜 만드나요?

### 해결하려는 문제

- **발견한 기회가 실제 도전으로 이어지지 않음**
  - 관심 있는 공모전이나 대외활동을 찾아도 계획에 반영하지 못해 지원 시기를 놓치는 경우

- **대학생활의 경험과 목표가 단편적으로 흩어짐**
  - 수강한 과목, 프로젝트, 대외활동이 서로 어떻게 연결되는지 파악하기 어려움

- **활동이 끝나면 과정과 배운 점이 남지 않음**
  - 시간이 흐른 뒤 자신의 역할이나 성과를 구체적으로 돌아보기 어려움

- **상황이 바뀌었을 때 기존 계획을 유연하게 수정하기 어려움**
  - 진로 변경, 휴학, 일정 변동 등에 따라 장기 계획을 다시 조정해야 하는 부담

- **꾸준한 실천과 기록을 유지하기 어려움**
  - 계획을 세워도 지속적으로 확인하거나 경험을 기록할 동기가 부족함

### 핵심 목적
- 다른 사람과 비교하지 않고 **나만의 성장 기록**을 남긴다. (순위·경쟁 기능 없음)
- 펫 성장은 실력을 증명하는 점수가 아니라, 꾸준히 기록하고 출석하도록 돕는 장치다.

### 핵심 흐름
학년·수강 과목·희망 직무 선택 → 교과과정 연계도 기반 로드맵 생성 → 대학생활 계획·수정 → 일기·활동 기록 → 성장 에너지 획득 → 펫 성장 → 추억 축적

---

## 2. 주요 기능 (모두 개발 예정)

| 기능 | 설명 | 페이지 |
| --- | --- | --- |
| 🗺️ **가로형 대학생활 로드맵** | 학기를 왼쪽→오른쪽으로 놓인 **세로 컨테이너(컬럼)** 로 보여주고, 그 안에 활동 노드(카드)를 자유롭게 배치. 드래그한 위치 저장, 관련 노드끼리 연결선, 휴학·군 복무·교환학생·초과학기 삽입 | `/roadmap` |
| 🐣 **펫 육성** | 홈의 '출석하기' 버튼(하루 1회 +10)과 공백 제외 30자 이상 일기(하루 1회 +20)로 성장 에너지를 얻어, 누적 에너지 0/50/150/300에서 펫이 4단계로 성장. 로그인만으로는 보상 없음, 같은 날 중복 보상 없음, 미접속 페널티 없음 | `/` (홈) |
| 📔 **일기** | 날짜별 일기 1개, 수정·삭제 | `/diary` |
| 🗂️ **추억 보관소** | 캘린더·학기별로 과거 일기 열람 | `/memories` |
| 🧭 **온보딩** | 학년(필수)·경험·수강 과목·희망 직무 선택. 2026 컴퓨터공학과 교과과정 연계도를 기준으로, 1~4학년 전체 과목 중 직접 고른 수강 과목은 권장 학기에 이수 완료로 배치하고, 현재 학년 이후의 미래 과목은 희망 직무 관련도에 맞춰(미선택 시 전공필수만) 선정해 권장 학기에 바로 배치(auto)하거나 보관함에 추가(inbox). 별도 추천 화면 없이 기본 로드맵으로 바로 제공 | `/onboarding` |
| 📢 **공고 탐색** | 공모전·해커톤·인턴십 공고 카드 목록 (MVP는 샘플 데이터) | `/explore` |
| 🔐 **로그인** | 이메일·비밀번호, Google 로그인. 내 데이터만 보임 | `/login` |

자세한 기능 명세는 [SPEC.md](SPEC.md)를 보세요.

---

## 3. 기술 스택

| 구분 | 사용 기술 |
| --- | --- |
| 프론트엔드 | React + Vite, React Router, React Flow |
| 스타일 | 일반 CSS (공통 색상·폰트·간격은 `tokens.css`) |
| DB | Supabase PostgreSQL |
| 인증 | Supabase Auth (이메일, Google) |
| 연결 방식 | 프론트엔드에서 Supabase SDK로 직접 연결 |
| 보안 | 모든 사용자 데이터에 RLS(행 수준 보안) 적용 |
| 서버 로직 | 여러 데이터를 함께 바꾸는 작업·보상 지급은 PostgreSQL 함수(RPC) |

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
│   ├── API.md           데이터 형식, Supabase 테이블·RLS·RPC 규격
│   └── references/      디자인 참고 자료 (roadmap-reference.png)
├── frontend/src/
│   ├── pages/           페이지 화면 (HomePage.jsx 등, 현재 빈 파일)
│   ├── features/        기능별 컴포넌트 (roadmap/, pet/, diary/, onboarding/ 예정)
│   ├── services/        Supabase 연결·데이터 처리 (공통 서비스 계층)
│   ├── data/            Mock Data, 교과과정·직무별 과목·공고 데이터
│   └── styles/          공통 스타일 (tokens.css 예정)
└── backend/src/         Node 서버 (MVP 미사용, 구조만 유지)
```

- 빈 폴더에 있는 `.gitkeep`은 폴더를 GitHub에 남기기 위한 빈 파일입니다. 지우지 마세요.
- Supabase SQL 변경 이력은 `supabase/migrations/`에 저장할 예정입니다. (아직 폴더 없음)

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

> 🚧 **아직 실행 환경이 만들어지지 않았습니다.**
> React + Vite 초기화(TASKS 0-3)와 Supabase 프로젝트 생성(TASKS 0-5)이 끝나면 이 부분에 실행 방법을 적습니다.

미리 알아둘 점:
- 비밀값은 `.env` 파일에 두고 **Git에 올리지 않습니다.** (`.gitignore`에 등록됨)
- 프론트 `.env`에는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`만 둡니다.
- **`service_role` 키는 절대 프론트 코드나 Git에 넣지 않습니다.**

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
| [docs/API.md](docs/API.md) | 데이터 형식, Supabase 테이블·RLS·RPC |
| [roadmap-reference.png](docs/references/roadmap-reference.png) | 로드맵 UI 참고 이미지 |

> 문서에서 `[미확정]`으로 표시된 내용은 아직 결정되지 않은 것입니다. 임의로 정하지 말고 팀에서 결정합니다.

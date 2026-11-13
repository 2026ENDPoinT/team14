# AI 길잡이 (로드맵) — 서버 담당 확인 사항

로드맵 상단 [종류 필터] 옆 [AI 길잡이]. 기존 Edge Function `recommend-career`를 확장했다 (새 함수·새 키 없음).

## 1. 무엇이 바뀌었나

| 위치 | 내용 |
| --- | --- |
| `supabase/functions/recommend-career/index.ts` | 요청 본문에 `mode`가 있으면 길잡이로 처리. 없으면 온보딩 추천 그대로. 요청 본문 20,000자 제한 추가 |
| `supabase/functions/recommend-career/guide.ts` (새 파일) | 길잡이 요청 확인·프롬프트·응답 스키마·응답 검증 (순수 함수) |
| `frontend/src/services/careerRecommendation.js` | `requestAiGuide(payload)`, `getMyRecentDiaries()` 추가 |

- 인증: 기존과 같다 (JWT 확인 + 함수 안 `auth.getUser`).
- Secret: 기존 `GEMINI_API_KEY` 그대로. 모델 순서·재시도 규칙도 같다.
- **DB migration 없음.** 길잡이 결과·성적·흥미도·일기는 저장하지 않는다. (`career_recommendations`도 쓰지 않음)

## 2. 요청 (`mode`가 있을 때)

```json
{
  "mode": "both | career | activities",
  "grade": 2,
  "currentJob": "backend",
  "keywords": ["데이터베이스", "웹 개발"],
  "courses": [{ "title": "데이터베이스", "status": "done", "grade": "B+", "interest": 4 }],
  "activities": [{ "title": "백엔드 팀 프로젝트", "category": "프로젝트", "status": "done", "memo": "120자까지" }],
  "diary": [{ "date": "2026-11-12", "text": "300자까지" }]
}
```

- `status`: 과목 `done`(완료 표시) / `planned`(학기에 배치), 활동 `done` / `planned` / `idea`(보관함)
- 성적은 `done` 과목에만 허용. A+~F. 흥미도 1~5. 모두 선택.
- 개수 제한: 과목 40, 활동 40, 일기 5, 키워드 15 (넘으면 400)
- `diary`는 사용자가 '내 일기도 함께 분석하기'를 켜고 고른 것만. 기본은 빈 배열.

## 3. 응답

```json
{
  "mode": "both",
  "careers": [{ "job": "backend", "reason": "", "strengths": [], "gaps": [], "actions": [], "basedOn": [] }],
  "activities": [{ "title": "", "category": "project", "reason": "", "basedOn": [], "timing": "",
                   "difficulty": "입문|중급|도전", "gains": [], "firstStep": "" }],
  "model": "gemini-…", "recommendedAt": "ISO 시각"
}
```

검증 (guide.ts `validateGuideOutput`) — 맞지 않으면 502 `AI_ERROR`:
- careers 2~3개 (`career`·`both`), activities 3~5개 (`activities`·`both`)
- `basedOn`은 요청에 보낸 과목·활동 이름·키워드(·'일기')에서만. 그 밖의 값은 지운다 → 근거를 지어낼 수 없다
- 이미 요청에 있는 활동·과목과 같은 이름(공백·기호 무시)의 추천 활동은 뺀다
- 문장에 URL이 있으면 뺀다 (가짜 공고 링크 방지). 공고는 프론트가 DB `job_postings`에서만 보여 준다
- 출력 토큰 3,072 제한, 모델당 20초

## 4. 배포 전 할 일 (3번)

1. 코드 검토 후 `supabase functions deploy recommend-career` (기존과 같은 배포. 함수 이름 그대로)
2. 배포 후 확인
   - 온보딩 AI 추천이 그대로 되는지 (`{ keywords }` 요청)
   - 로드맵 → AI 길잡이 → 분석하기: 직무·활동 카드가 나오는지
   - `GEMINI_API_KEY`가 없을 때 오류 화면만 나오는지 (가짜 결과 없음)
3. 일기: 지금 일기 화면은 Mock이라 실제 `diaries` 테이블에 글이 없다. `save_diary` RPC가 연결되면 길잡이가 본인 일기(RLS `diaries_select_own`)를 읽는다. 추가 작업 없음.

## 5. 아직 안 된 것

- 성적 영구 저장: DB 칸이 없어 이번 분석에만 쓴다. 저장하려면 별도 동의 화면 + 테이블(RLS)이 필요하다 [미확정].
- 전공: `profiles`에 전공 칸이 없어 '컴퓨터공학 교과과정 기준'으로 보낸다.
- '진행 중' 상태: 노드에 없어서 완료(completed) / 계획(학기 배치) / 보관함으로만 나눈다.
- 실제 Gemini 응답 품질은 배포 후 확인해야 한다 (로컬 테스트는 가짜 응답).

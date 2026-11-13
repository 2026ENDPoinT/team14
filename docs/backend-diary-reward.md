# 일기 온기 보상: 백엔드 작업 요청 (3번 담당)

> 작성: 1번 (feature/ux-korean-nav → feature/pet-home-figma에서 규칙 최종 수정) · 상태: **요청 (DB 미적용)**
> 프론트는 아직 Mock(`frontend/src/features/diary/diaryMock.js`)으로만 동작한다. 실제 DB에 일기 저장·온기 지급은 없다.
> 아래 SQL은 초안이다. 검토 후 `supabase/migrations/`에 **새 파일**로 추가해 주세요.

## 1. 확정된 보상 규칙

| 상황 | 일기 저장 | 온기 |
| --- | --- | --- |
| 오늘(서버 기준 Asia/Seoul) 날짜 일기를 공백 포함 20자 이상으로 저장 | 저장 | **+200**, 하루 1회 |
| 오늘 일기를 20자 미만으로 저장 | 저장 | 없음 |
| 20자 미만으로 저장한 오늘 일기를 같은 날 수정해 20자 이상 달성 | 저장 | **+200** (그날 아직 안 받았을 때 최초 1회) |
| 오늘 이미 일기 온기를 받음 → 수정·재저장·삭제 후 재작성 | 저장 | 없음 (보상 이력은 삭제하지 않음) |
| 과거 날짜 일기 작성·수정 | 저장 | 없음 |
| 미래 날짜 | **작성 불가** | 없음 |

- 날짜 판정은 **서버 시각**으로 한다: `(now() at time zone 'Asia/Seoul')::date`. 프론트가 보낸 "오늘"을 믿지 않는다.
- **일기 저장이 성공한 같은 트랜잭션 안에서만** 지급한다. 저장이 실패하면 지급도 없다.
- 과거 날짜 일기는 보상 조건과 상관없이 **정상 저장**돼야 한다.

## 2. 기존 문서와 다른 점 (문서 수정 필요)

| 항목 | 기존 문서 (`SPEC.md` 8장, `docs/API.md` 2·3·4.6장) | 현재 결정 / 프론트 |
| --- | --- | --- |
| 일기 보상 에너지 | **+20** | **+200** (`diaryMock.js`의 `DIARY_REWARD`) |
| 보상 대상 날짜 | 지급일 기준 하루 1회, "일기의 `date`와 무관" (과거 일기를 오늘 써도 지급) | **일기 `date` = 서버 오늘**일 때만 지급 |
| 글자 수 기준 | 공백 제외 30자 이상 | 공백 포함 20자 이상 (`countChars.js`의 `REWARD_MIN_CHARS`) |
| 짧게 저장 후 수정해 기준 충족 | 그날 아직 안 받았으면 지급 | **같음 (확정)**: 오늘 날짜 일기면 최초 1회 지급 |
| 펫 단계 기준 에너지 | 0 / 50 / 150 / 300 | **0 / 1200 / 2800 / 5000 (확정)**, 누적 획득 온기 기준 (`petStages.js`) |
| 보상 type 이름 | `diary_first_of_day` | Mock 결과는 `diary_first_write` → 서버 값(`diary_first_of_day`)으로 통일 권장 |

## 3. 필요한 DB 작업

이미 있는 것 (변경 불필요)
- `diaries` 테이블: 사용자·날짜당 1개 (`unique (user_id, date)`), RLS 켜짐, 작성·수정은 RPC로만
- `reward_events` 테이블: `unique (user_id, type, ref_id)` → 하루 1회 보장, 프론트 쓰기 불가
- `pets.energy`: 보상 RPC만 변경

새로 필요한 것
1. RPC `save_diary(p_date date, p_content text, p_mood text, p_linked_node_id uuid)` (아래 초안)
   - `auth.uid()` 확인, 없으면 `UNAUTHENTICATED`
   - 미래 날짜는 거부 (`VALIDATION_ERROR`)
   - 일기 insert/update → 오늘 날짜·20자 이상이면 `reward_events` insert (`on conflict do nothing`) → 새로 들어갔을 때만 `pets.energy + 200`
   - 온기 잔액 칸이 생기면(`docs/backend-pet-home.md`) 잔액도 같이 +200
   - 결과: `{ diary, reward: { rewarded, energy? , reason? }, pet }`
   - `reason`: `NOT_TODAY` | `TOO_SHORT` | `ALREADY_REWARDED` (프론트 안내 문구에 사용 중)
2. `grant execute ... to authenticated`, `revoke ... from public`
3. 일기 삭제는 기존 계획대로 테이블 delete (RLS `diaries_delete_own`). `reward_events`는 지우지 않는다.
4. 펫 `stage` 재계산: 기준값이 문서와 프론트가 달라 **이번 초안에서는 stage를 바꾸지 않음** → 기준값 확정 후 추가

```sql
-- [초안 · 미적용] save_diary
create or replace function public.save_diary(
  p_date date,
  p_content text,
  p_mood text default null,
  p_linked_node_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date; -- 서버가 계산한 KST 오늘
  v_diary public.diaries;
  v_reward_id uuid;
  v_pet public.pets;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  if p_date is null or p_date > v_today then
    raise exception 'VALIDATION_ERROR' using errcode = '22023';
  end if;

  -- 일기 저장 (사용자·날짜당 1개, 있으면 수정)
  insert into public.diaries (user_id, date, mood, content, linked_node_id)
  values (v_uid, p_date, p_mood, coalesce(p_content, ''), p_linked_node_id)
  on conflict (user_id, date) do update
    set mood = excluded.mood, content = excluded.content, linked_node_id = excluded.linked_node_id
  returning * into v_diary;

  -- 보상: 오늘 날짜 + 공백 포함 20자 이상 → 하루 1회 (새로 쓰기·수정 모두. 유일 제약이 중복을 막음)
  -- char_length는 문자 수(코드 포인트)로 센다 = 프론트 countChars([...text].length)와 같은 방식
  if p_date = v_today and char_length(coalesce(p_content, '')) >= 20 then
    insert into public.reward_events (user_id, type, ref_id, energy)
    values (v_uid, 'diary_first_of_day', v_today::text, 200)
    on conflict (user_id, type, ref_id) do nothing
    returning id into v_reward_id;
  end if;

  if v_reward_id is not null then
    update public.pets set energy = energy + 200 where user_id = v_uid returning * into v_pet;
  else
    select * into v_pet from public.pets where user_id = v_uid;
  end if;

  return jsonb_build_object(
    'diary', to_jsonb(v_diary),
    'reward', case when v_reward_id is not null
      then jsonb_build_object('rewarded', true, 'energy', 200)
      else jsonb_build_object('rewarded', false, 'reason',
        case when p_date <> v_today then 'NOT_TODAY'
             when char_length(coalesce(p_content, '')) < 20 then 'TOO_SHORT'
             else 'ALREADY_REWARDED' end)
      end,
    'pet', to_jsonb(v_pet)
  );
end;
$$;

revoke all on function public.save_diary(date, text, text, uuid) from public;
grant execute on function public.save_diary(date, text, text, uuid) to authenticated;
```

## 4. 결정이 필요한 것

확정됨 (문서 `SPEC.md`·`API.md` 반영 필요)
- 글자 수: **공백 포함 20자 이상**
- 20자 미만 저장 후 같은 날 수정으로 달성: **지급 (최초 1회)**
- 펫 단계: **0 / 1200 / 2800 / 5000**, 누적 획득 온기 기준 (온기를 써도 단계는 내려가지 않음)
- 미래 날짜: **작성 불가**

남은 것
- 펫 `stage`를 RPC에서 다시 계산할지, 조회 시 energy로 계산할지

## 5. 서버 준비 후 프론트 작업 (2번·1번)

- `frontend/src/services/`에 `saveDiary` 함수 추가 → `supabase.rpc('save_diary', …)`, snake_case → camelCase 변환
- `DiaryModal.jsx`가 `diaryMock.js` 대신 서비스 함수를 쓰도록 교체
- 온기 연출(`WarmthEffect`)은 서버 응답 `reward.rewarded === true`일 때만
- 저장 실패(일기 저장 안 됨)와 저장 성공 + 보상 없음(reason 안내)을 구분해서 안내 (문구는 이미 `DiaryModal.jsx`에 있음)

## 6. 확인 체크리스트 (DB 적용 후)

- [ ] 오늘 첫 일기 → `rewarded: true`, `pets.energy` +200, `reward_events` 1행
- [ ] 오늘 10자 저장 → `rewarded: false (TOO_SHORT)` → 같은 날 20자 이상으로 수정 → `rewarded: true` +200
- [ ] 받은 뒤 같은 날 수정·재저장 → `rewarded: false (ALREADY_REWARDED)`, 행 추가 없음
- [ ] 삭제 후 다시 작성 → `rewarded: false (ALREADY_REWARDED)`
- [ ] 과거 날짜 작성·수정 → 저장됨, `rewarded: false (NOT_TODAY)`
- [ ] 미래 날짜 → `VALIDATION_ERROR`, 저장 안 됨
- [ ] 같은 요청 동시 2회 → 보상 1회만
- [ ] 자정(KST) 전후로 날짜 판정이 서버 시각을 따름
- [ ] 로그인 안 한 요청 → `UNAUTHENTICATED`

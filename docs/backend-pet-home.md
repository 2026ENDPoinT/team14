# 펫 HOME: 백엔드·에셋 작업 요청

> 작성: 1번 (feature/pet-home-figma) · 상태: **요청 (DB 미적용)**
> HOME 화면(`frontend/src/pages/HomePage.jsx`)은 Mock 펫 데이터로 동작한다. 출석·펫 이름 변경은 서버 기능이 없어 "준비 중" 안내만 하고, 온기를 지급하거나 차감하지 않는다.

## 1. 확정된 규칙

| 항목 | 규칙 |
| --- | --- |
| 출석 | 하루 첫 출석 **+100P**, 서버 KST 날짜 기준 1회 (기존 문서 +10 → 변경) |
| 일기 | 오늘 날짜 일기 공백 포함 20자 이상 **+200P**, 하루 1회 (`docs/backend-diary-reward.md`) |
| 성장 단계 | **누적 획득 온기** 0 / 1200 / 2800 / 5000 → 1~4단계. 온기를 써도 단계는 내려가지 않음 |
| 펫 이름 | 최대 8자, **첫 변경 무료, 이후 변경마다 300P** |
| 펫 종류 | backend·frontend·mobile → penguin(포), ai·data → otter(루), security·system_network → black_cat(밤), embedded_iot·game → hamster(뭉), uiux → rabbit(솜). undecided·other는 온보딩에서 고른 펫 |

## 2. 지금 DB와 다른 점

| 필요한 것 | 지금 DB (`20261109000100_create_core_tables.sql`) |
| --- | --- |
| 누적 획득 온기 (단계 판정) | `pets.energy` 있음 (차감 없음) → 그대로 사용 |
| **온기 잔액** (이름 변경 비용 차감) | **없음** → 예: `pets.warmth_balance integer not null default 0 check (>= 0)` |
| **펫 이름** | **없음** → 예: `pets.name text check (char_length(name) between 1 and 8)` |
| 이름 무료 변경 사용 여부 | **없음** → 예: `pets.name_change_count integer not null default 0` |
| 펫 종류 | `pets.type text` 있음. 온보딩 RPC가 값을 넣지 않음(null) |
| undecided·other의 펫 선택 | **온보딩에 펫 고르는 단계·저장 칸 없음**. 직무 목록에 `other` 키도 없음 |
| 출석 RPC | `check_in` 문서에만 있음, **미구현** |
| 이름 변경 RPC | **없음** |
| 펫 조회 서비스 함수 | **없음** (`frontend/src/services/`에 펫 조회 함수 필요) |

`reward_events.type`에 이름 변경 같은 "사용" 기록을 남길지(별도 `warmth_spends` 테이블 등)는 3번이 결정해 주세요.

## 3. 필요한 서버 작업 (모두 새 migration으로)

1. `pets` 칸 추가: `name`, `warmth_balance`, `name_change_count` (기존 행은 `warmth_balance = energy`로 채우기 권장)
2. 온보딩 RPC에서 `pets.type` 저장
   - 희망 직무 → 펫 키 매핑(1장) 또는 직무 키 그대로. 프론트는 둘 다 읽는다 (`features/home/petCharacter.js`)
   - undecided·other: 온보딩 화면에 펫 고르기 단계 추가 필요 (4번 담당 화면) → 고른 펫 키 저장
3. `check_in()` RPC
   - `auth.uid()` 확인 → 서버 KST 오늘로 `reward_events (attendance, 오늘)` insert `on conflict do nothing`
   - 새로 들어갔을 때만 `energy + 100`, `warmth_balance + 100`
   - 결과 `{ reward: { rewarded, energy? }, pet }`
4. `rename_pet(p_name text)` RPC — 이름 저장과 차감을 **한 트랜잭션**으로
   - 이름 1~8자(앞뒤 공백 제거) 검사
   - `name_change_count = 0`이면 무료, 아니면 `warmth_balance >= 300` 확인 후 300 차감 (부족하면 `INSUFFICIENT_WARMTH`, 아무것도 안 바꿈)
   - `energy`(누적)는 차감하지 않음 → 단계 유지
   - 결과 `{ pet, cost }`
5. `save_diary`에서 지급 시 `warmth_balance`도 +200

## 4. 캐릭터 이미지 (디자인 담당)

`docs/references/figma/Pet/<동물>/0N_transprent.png`(투명 배경 캐릭터)를 아래 이름으로 `frontend/src/assets/pets/`에 복사해 두었다. 이 폴더에 파일을 넣으면 코드 수정 없이 바로 표시된다.
같은 폴더의 `01/Sprout.png`, `02.png`~`04.png`는 배경·메뉴가 들어간 HOME 전체 화면 스크린샷(1440×900, 투명 픽셀 0개)이라 쓰지 않는다.

| 파일 | 내용 | 상태 |
| --- | --- | --- |
| `sprout.png` | 1단계 공통 새싹 | **없음** — 투명 PNG를 내보내야 함 (그 전까지 대체 상태 표시) |
| `penguin-2.png`, `penguin-3.png`, `penguin-4.png` | 펭귄 2~4단계 | 있음 |
| `otter-2.png`, `otter-3.png`, `otter-4.png` | 수달 2~4단계 | 있음 |
| `black_cat-2.png`, `black_cat-3.png`, `black_cat-4.png` | 검은 고양이 2~4단계 | 있음 (원본 폴더 `Cat`) |
| `hamster-2.png`, `hamster-3.png`, `hamster-4.png` | 햄스터 2~4단계 | 있음 |
| `rabbit-2.png`, `rabbit-3.png`, `rabbit-4.png` | 토끼 2~4단계 | 있음 |

권장: 캐릭터 실제 크기의 2배(예: 최대 600×540px), 여백 최소.

## 5. 서버 준비 후 프론트 작업

- `features/home/homeActions.js`의 `checkIn`·`renamePet`을 services 함수로 교체 (결과 모양은 파일 주석과 같게)
- `HomePage.jsx`의 `getPet()`(Mock)을 펫 조회 서비스로 교체 → 로그인 사용자별 데이터
- 오늘 출석 여부 조회(`reward_events` attendance 오늘)로 출석 버튼 완료 상태 표시
- 이름 변경 버튼에 "무료 / 300P" 표시 (`name_change_count` 기준)

## 6. 확인 체크리스트 (DB 적용 후)

- [ ] 출석 첫 요청 +100, 같은 날 재요청 `rewarded: false`
- [ ] 이름 첫 변경 무료, 두 번째부터 300 차감, 잔액 부족 시 변경·차감 모두 없음
- [ ] 이름 변경 후에도 `energy`·단계 그대로
- [ ] 9자 이상 이름 거부
- [ ] 다른 사용자의 펫을 읽거나 바꿀 수 없음 (RLS)

## 7. 희망 직무 변경 → 펫 종류 (2026-11-12 추가)

### 지금 프론트 동작 (DB 변경 없이 연결됨)
- 마이페이지에서 희망 직무를 바꾸면 `profiles.interests`를 `[직무 키]`로 저장한다 (`updateMyDesiredJob`, 기존 RLS·컬럼 권한 그대로).
- HOME 펫 종류는 `pets.type`이 비어 있으면 `interests[0]`(대표 직무)로 정한다 → 저장하면 펫이 바뀌고 새로고침 후에도 유지.
- 펫 온기·단계·보상 기록은 건드리지 않는다. 기본 이름은 새 펫의 기본 이름을 따르고, `pets.name`이 생기면 그 이름이 우선이다.

### 남은 문제
- '미정'으로 바꾸면 이전 펫을 기억할 곳이 없다 (`pets.type`이 모두 null, `pets`는 프론트에서 수정 불가).
  → 지금은 마이페이지에서 '미정'으로 바꾸는 것을 막는다 (직무 목록에도 '미정'이 없다).
- 나중에 `pets.type`에 값이 들어가면 HOME은 `pets.type`을 먼저 보므로, 직무를 바꿀 때 `pets.type`도 함께 바꿔야 한다.

### 요청: 희망 직무 변경 RPC (초안, 적용 전 검토)
```sql
-- 희망 직무 변경 + 펫 종류 맞추기 (온기·단계·이름 변경 횟수·보상 기록은 그대로)
create or replace function public.change_desired_job(p_job text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_old text;
  v_pet text;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using detail = '로그인이 필요합니다.';
  end if;
  if p_job is null or btrim(p_job) = '' then
    raise exception 'VALIDATION_ERROR' using detail = '희망 직무를 골라 주세요.';
  end if;

  select interests[1] into v_old from profiles where id = v_uid for update;

  v_pet := case
    when p_job in ('backend', 'frontend', 'mobile') then 'penguin'
    when p_job in ('ai', 'data') then 'otter'
    when p_job in ('security', 'system_network') then 'black_cat'
    when p_job in ('embedded_iot', 'game') then 'hamster'
    when p_job = 'uiux' then 'rabbit'
    else null -- undecided·기타: 기존 펫 유지
  end;

  update profiles set interests = array[p_job] where id = v_uid;

  if v_pet is not null then
    update pets set type = v_pet where user_id = v_uid and type is distinct from v_pet;
  else
    -- 처음 미정으로 바꿀 때 이전 직무의 펫을 기록해 둔다 (type이 비어 있을 때만)
    update pets set type = case
        when v_old in ('backend', 'frontend', 'mobile') then 'penguin'
        when v_old in ('ai', 'data') then 'otter'
        when v_old in ('security', 'system_network') then 'black_cat'
        when v_old in ('embedded_iot', 'game') then 'hamster'
        when v_old = 'uiux' then 'rabbit'
      end
    where user_id = v_uid and type is null;
  end if;

  return jsonb_build_object(
    'user', (select to_jsonb(p) from profiles p where p.id = v_uid),
    'pet', (select to_jsonb(pt) from pets pt where pt.user_id = v_uid)
  );
end;
$$;

revoke all on function public.change_desired_job(text) from public, anon;
grant execute on function public.change_desired_job(text) to authenticated;
```
- 온보딩(`complete_onboarding`)에서도 같은 규칙으로 `pets.type`을 채우면 좋다 (지금은 null).
- RPC 적용 후 프론트: `updateMyDesiredJob`을 이 RPC 호출로 바꾸고, 마이페이지의 '미정' 차단을 푼다.

## 8. 자동 출석 `check_in` (2026-11-12 추가)

HOME의 '출석하기' 버튼을 없애고, **로그인 사용자가 HOME에 들어오면 자동으로** `check_in`을 부른다.
프론트(`services/api.js` `checkInToday`, `features/home/homeActions.js` `autoCheckIn`)는 이미 연결되어 있고,
RPC가 없으면(`PGRST202`) 조용히 넘어간다 — 지급 연출·숫자 변경 없음, 오류 안내 없음.

### 프론트가 기대하는 응답 (jsonb)
```json
{
  "rewarded": true,
  "energy": 100,
  "date": "2026-11-12",
  "pet": { "energy": 1500, "warmth_balance": 1500, "stage": 2 }
}
```
- 오늘 이미 출석했으면 `rewarded: false`, `energy: 0` (pet은 현재 값)
- `pet.energy` = 누적 획득 온기(단계 판정, 줄지 않음) / `pet.warmth_balance` = 보유 온기(이름 변경 등에 사용)
- 응답에 `rewarded`(boolean)·`pet.energy`·`pet.warmth_balance`(숫자)가 없으면 프론트는 지급으로 보지 않는다

### 중복 방지 (서버가 보장)
- 날짜는 서버가 정한다: `(now() at time zone 'Asia/Seoul')::date`
- `reward_events (user_id, type, ref_id)` 고유 제약 + `insert … on conflict do nothing returning`
  → 새로 들어간 경우에만 같은 트랜잭션에서 `pets` 갱신. 여러 탭이 동시에 불러도 한 번만 지급
- 프론트는 같은 사용자·같은 한국 날짜에 요청을 한 번만 보내도록 줄일 뿐, 지급 여부는 항상 서버 응답으로만 판단

### migration 초안 (적용 전 검토, 아직 실행하지 않음)
```sql
-- 1) 보유 온기 칸 (기존 행은 누적 온기로 채움)
alter table public.pets
  add column if not exists warmth_balance integer not null default 0 check (warmth_balance >= 0);
update public.pets set warmth_balance = energy where warmth_balance = 0 and energy > 0;

-- 2) 출석 RPC
create or replace function public.check_in()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_reward constant integer := 100;
  v_inserted uuid;
  v_pet public.pets;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using detail = '로그인이 필요합니다.';
  end if;

  -- 펫이 없으면 보상 기록도 남기지 않는다
  if not exists (select 1 from public.pets where user_id = v_uid) then
    raise exception 'NOT_FOUND' using detail = '펫이 없습니다. 온보딩을 먼저 완료해 주세요.';
  end if;

  insert into public.reward_events (user_id, type, ref_id, energy)
  values (v_uid, 'attendance', v_today::text, v_reward)
  on conflict (user_id, type, ref_id) do nothing
  returning id into v_inserted;

  if v_inserted is not null then
    update public.pets
       set energy = energy + v_reward,
           warmth_balance = warmth_balance + v_reward,
           stage = case
             when energy + v_reward >= 5000 then 4
             when energy + v_reward >= 2800 then 3
             when energy + v_reward >= 1200 then 2
             else 1 end
     where user_id = v_uid
    returning * into v_pet;
  else
    select * into v_pet from public.pets where user_id = v_uid;
  end if;

  return jsonb_build_object(
    'rewarded', v_inserted is not null,
    'energy', case when v_inserted is not null then v_reward else 0 end,
    'date', v_today,
    'pet', jsonb_build_object('energy', v_pet.energy, 'warmth_balance', v_pet.warmth_balance, 'stage', v_pet.stage)
  );
end;
$$;

revoke all on function public.check_in() from public, anon;
grant execute on function public.check_in() to authenticated;
```
- `save_diary`의 +200도 같은 방식으로 `warmth_balance`를 함께 올려야 한다 (5번 항목).
- 펫 조회 서비스가 생기면 HOME의 Mock 펫(`getPet`)을 실제 값으로 바꾼다 → 출석 전에도 실제 잔액 표시.

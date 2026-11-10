-- TASKS 3-11 (+3-12 과목 노드 저장): 온보딩 완료 RPC (docs/API.md 4.2)
--
-- 호출 (서비스 계층에서 camelCase → snake_case 변환 후):
--   supabase.rpc('complete_onboarding', {
--     grade: 2,                                   -- 필수, 1~4
--     nickname: '민수',                           -- 생략 가능
--     experiences: ['hackathon'],                 -- 생략 가능 (경험 키 목록)
--     completed_courses: ['cs2026-1-1-01'],       -- 생략 가능
--     interests: ['backend'],                     -- 생략 가능
--     roadmap_mode: 'auto',                       -- 생략 시 'auto'
--     course_nodes: [ { course_key, title, year, semester, completed } ]  -- 생략 가능
--   })
-- 성공: { user, periods, nodes, pet } (안쪽 필드는 DB 컬럼 이름 = snake_case)
-- 실패: 오류 message가 VALIDATION_ERROR / UNAUTHENTICATED / NOT_FOUND / CONFLICT,
--       detail에 한글 설명. 실패하면 아무것도 저장되지 않는다.

-- ------------------------------------------------------------
-- 경험 키 → 노드 제목·테마 매핑
-- 아직 팀이 확정하지 않았으므로 비워 둔다. 확정되면 새 migration으로 행을 추가한다.
-- 비어 있는 동안 experiences에 값이 있으면 온보딩은 VALIDATION_ERROR로 실패한다.
-- (경험 노드가 빠진 채 온보딩이 완료되는 일을 막기 위함)
-- ------------------------------------------------------------
create table public.onboarding_experience_types (
  key text primary key,
  title text not null check (char_length(btrim(title)) > 0),
  theme text not null
    check (theme in ('major', 'project', 'external', 'career', 'research', 'event', 'free')),
  created_at timestamptz not null default now()
);
-- 함수 안에서만 읽는다. 로그인 사용자는 직접 접근하지 않는다.
alter table public.onboarding_experience_types enable row level security;
revoke all on table public.onboarding_experience_types from anon, authenticated;

-- ------------------------------------------------------------
-- complete_onboarding
-- ------------------------------------------------------------
create or replace function public.complete_onboarding(
  grade integer,
  nickname text default null,
  experiences text[] default '{}',
  completed_courses text[] default '{}',
  interests text[] default '{}',
  roadmap_mode text default 'auto',
  course_nodes jsonb default '[]'
)
returns jsonb
language plpgsql
security definer          -- pets·timeline_periods 등 직접 쓸 수 없는 테이블에 쓰기 위해 필요
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- 인자 이름이 컬럼 이름과 같아서, 처음에 v_ 변수로 옮겨 두고 이후에는 v_만 쓴다.
  v_uid uuid := auth.uid();
  v_grade integer := complete_onboarding.grade;
  v_nickname text := nullif(btrim(complete_onboarding.nickname), '');
  v_experiences text[] := coalesce(complete_onboarding.experiences, '{}');
  v_completed text[] := coalesce(complete_onboarding.completed_courses, '{}');
  v_interests text[] := coalesce(complete_onboarding.interests, '{}');
  v_mode text := coalesce(complete_onboarding.roadmap_mode, 'auto');
  v_courses jsonb := coalesce(complete_onboarding.course_nodes, '[]'::jsonb);
  v_done boolean;
  v_item jsonb;
  v_text text;
begin
  -- 1. 사용자 인증 -------------------------------------------------
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using detail = '로그인이 필요합니다.';
  end if;

  -- 본인 프로필 행을 잠근다. 동시에 두 번 호출되면 두 번째 호출은 첫 번째가
  -- 끝날 때까지 여기서 기다린 뒤, 완료된 상태를 보고 CONFLICT로 끝난다.
  select p.onboarding_completed into v_done
  from public.profiles p
  where p.id = v_uid
  for update;

  if not found then
    raise exception 'NOT_FOUND' using detail = '프로필이 없습니다.';
  end if;
  if v_done then
    raise exception 'CONFLICT' using detail = '이미 온보딩을 완료했습니다.';
  end if;

  -- 2. 입력 검증 (저장 전에 모두 확인) ------------------------------
  if v_grade is null or v_grade not between 1 and 4 then
    raise exception 'VALIDATION_ERROR' using detail = 'grade는 1~4 중 하나여야 합니다.';
  end if;

  if v_mode not in ('auto', 'inbox') then
    raise exception 'VALIDATION_ERROR' using detail = 'roadmap_mode는 auto 또는 inbox여야 합니다.';
  end if;

  if exists (select 1 from unnest(v_experiences) e where e is null or btrim(e) = '')
     or exists (select 1 from unnest(v_completed) c where c is null or btrim(c) = '')
     or exists (select 1 from unnest(v_interests) i where i is null or btrim(i) = '') then
    raise exception 'VALIDATION_ERROR' using detail = '목록에 빈 값이 있습니다.';
  end if;

  if jsonb_typeof(v_courses) <> 'array' then
    raise exception 'VALIDATION_ERROR' using detail = 'course_nodes는 배열이어야 합니다.';
  end if;

  for v_item in select value from jsonb_array_elements(v_courses) loop
    -- 형식: 필드 타입과 빈 값
    if jsonb_typeof(v_item) <> 'object'
       or jsonb_typeof(v_item -> 'course_key') is distinct from 'string'
       or jsonb_typeof(v_item -> 'title') is distinct from 'string'
       or jsonb_typeof(v_item -> 'year') is distinct from 'number'
       or jsonb_typeof(v_item -> 'semester') is distinct from 'number'
       or jsonb_typeof(v_item -> 'completed') is distinct from 'boolean'
       or btrim(v_item ->> 'course_key') = ''
       or btrim(v_item ->> 'title') = '' then
      raise exception 'VALIDATION_ERROR'
        using detail = format('course_nodes 항목 형식이 올바르지 않습니다: %s', v_item);
    end if;
    -- 학기 범위
    if (v_item ->> 'year') not in ('1', '2', '3', '4')
       or (v_item ->> 'semester') not in ('1', '2') then
      raise exception 'VALIDATION_ERROR'
        using detail = format('year는 1~4, semester는 1~2여야 합니다: %s', v_item);
    end if;
    -- 추천 과목은 미래 학년만
    if not (v_item ->> 'completed')::boolean and (v_item ->> 'year')::integer <= v_grade then
      raise exception 'VALIDATION_ERROR'
        using detail = format('추천 과목은 현재 학년 이후(year > grade)만 가능합니다: %s', v_item);
    end if;
  end loop;

  -- 중복 노드: 같은 course_key 금지
  if (select count(*) from jsonb_array_elements(v_courses))
     <> (select count(distinct value ->> 'course_key') from jsonb_array_elements(v_courses)) then
    raise exception 'VALIDATION_ERROR' using detail = 'course_nodes에 같은 course_key가 있습니다.';
  end if;

  -- 일치 여부: completed: true 과목 키 목록 = completed_courses
  if exists (
    (select c from unnest(v_completed) c
     except
     select value ->> 'course_key' from jsonb_array_elements(v_courses)
     where (value ->> 'completed')::boolean)
    union all
    (select value ->> 'course_key' from jsonb_array_elements(v_courses)
     where (value ->> 'completed')::boolean
     except
     select c from unnest(v_completed) c)
  ) then
    raise exception 'VALIDATION_ERROR'
      using detail = 'completed_courses와 course_nodes의 이수 완료 과목이 다릅니다.';
  end if;

  -- 경험 키: 확정된 매핑에 있는 키만 허용
  select string_agg(e, ', ') into v_text
  from (select distinct e from unnest(v_experiences) e) x
  where not exists (
    select 1 from public.onboarding_experience_types t where t.key = x.e
  );
  if v_text is not null then
    raise exception 'VALIDATION_ERROR'
      using detail = format('제목·테마가 확정되지 않은 경험 키입니다: %s', v_text);
  end if;

  -- 3. 저장 ---------------------------------------------------------
  -- 프로필 + 온보딩 완료 표시
  update public.profiles p
  set nickname = coalesce(v_nickname, p.nickname),
      grade = v_grade,
      interests = v_interests,
      onboarding_completed = true
  where p.id = v_uid;

  -- 기본 8학기 (1학년 1학기 = 0 ... 4학년 2학기 = 7)
  insert into public.timeline_periods (user_id, type, name, sort_order)
  select v_uid, 'semester', format('%s학년 %s학기', o / 2 + 1, o % 2 + 1), o
  from generate_series(0, 7) as o;

  -- 펫 (사용자당 1마리, type은 [미확정]이라 비워 둠)
  insert into public.pets (user_id)
  values (v_uid)
  on conflict (user_id) do nothing;

  -- 경험 노드: 항상 보관함 (같은 키를 여러 번 보내도 1개만)
  insert into public.nodes (user_id, title, theme, status, source)
  select v_uid, t.title, t.theme, 'stored', 'onboarding'
  from public.onboarding_experience_types t
  where t.key = any (v_experiences)
  order by array_position(v_experiences, t.key);

  -- 교과목 노드
  --   이수 완료: 항상 권장 학기에 배치 (roadmap_mode 무관)
  --   추천: auto → 권장 학기 / inbox → 보관함
  --   권장 학기 위치 = (year - 1) * 2 + (semester - 1)
  insert into public.nodes
    (user_id, title, theme, period_id, status, source, origin_key, completed)
  select v_uid,
         btrim(x.title),
         'major',
         p.id,
         case when p.id is null then 'stored' else 'placed' end,
         case when x.completed then 'completed_course' else 'recommended' end,
         'course:' || x.course_key,
         x.completed
  from (
    select value ->> 'title' as title,
           value ->> 'course_key' as course_key,
           (value ->> 'completed')::boolean as completed,
           ((value ->> 'year')::integer - 1) * 2 + ((value ->> 'semester')::integer - 1) as sort_order
    from jsonb_array_elements(v_courses)
  ) x
  left join public.timeline_periods p
    on p.user_id = v_uid
   and p.sort_order = x.sort_order
   and (x.completed or v_mode = 'auto')
  on conflict (user_id, origin_key) do nothing;   -- 이미 있는 과목 노드는 건너뜀

  -- 4. 결과 ---------------------------------------------------------
  return jsonb_build_object(
    'user', (
      select to_jsonb(p) || jsonb_build_object('email', u.email)
      from public.profiles p
      join auth.users u on u.id = p.id
      where p.id = v_uid
    ),
    'periods', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.sort_order), '[]'::jsonb)
      from public.timeline_periods t
      where t.user_id = v_uid
    ),
    'nodes', (
      select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at, n.id), '[]'::jsonb)
      from public.nodes n
      where n.user_id = v_uid
    ),
    'pet', (
      select to_jsonb(pt)
      from public.pets pt
      where pt.user_id = v_uid
    )
  );
end;
$$;

-- 로그인 사용자만 호출할 수 있다.
revoke execute on function public.complete_onboarding(integer, text, text[], text[], text[], text, jsonb)
  from public, anon;
grant execute on function public.complete_onboarding(integer, text, text[], text[], text[], text, jsonb)
  to authenticated;

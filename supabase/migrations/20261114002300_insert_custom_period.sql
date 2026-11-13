-- 학기 추가에 '기타' (사용자가 이름을 정하는 타임라인 칸)
-- - insert_timeline_period에 p_name을 더한다. 'custom'(기타)일 때만 쓰고, 앞뒤 공백을 빼고 1~10자.
-- - 휴학·군휴학·교환학생은 그대로 (p_name 무시). 끼워 넣기·순서 변경·요청 id 중복 방지 규칙은 20261113002100과 같다.
-- - 기존 3개 인자 함수는 지우고 4개 인자 함수로 바꾼다 (p_name 기본값 null → 3개 인자로 부르던 요청도 그대로 동작)

drop function if exists public.insert_timeline_period(text, uuid, uuid);

create function public.insert_timeline_period(
  p_type text,
  p_after_period_id uuid default null,
  p_request_id uuid default null,
  p_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_order integer;
  v_period public.timeline_periods;
  v_created boolean := false;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using detail = '로그인이 필요합니다.';
  end if;
  v_name := case p_type
    when 'leave' then '휴학'
    when 'military' then '군휴학'
    when 'exchange' then '교환학생'
    when 'custom' then nullif(btrim(coalesce(p_name, '')), '')
  end;
  if p_type not in ('leave', 'military', 'exchange', 'custom') then
    raise exception 'VALIDATION_ERROR' using detail = '휴학·군휴학·교환학생·기타만 추가할 수 있습니다.';
  end if;
  if v_name is null then
    raise exception 'VALIDATION_ERROR' using detail = '이름을 입력해 주세요.';
  end if;
  if char_length(v_name) > 10 then
    raise exception 'VALIDATION_ERROR' using detail = '이름은 10자까지 쓸 수 있습니다.';
  end if;
  if p_request_id is null then
    raise exception 'VALIDATION_ERROR' using detail = '요청 id가 필요합니다.';
  end if;

  -- 같은 사용자의 학기 추가는 한 번에 하나씩 (순서 계산이 겹치지 않게)
  perform 1 from public.profiles where id = v_uid for update;

  -- 이미 처리한 요청이면 그대로 돌려준다
  select * into v_period from public.timeline_periods where user_id = v_uid and request_id = p_request_id;

  if v_period.id is null then
    if p_after_period_id is null then
      select coalesce(max(sort_order) + 1, 0) into v_order from public.timeline_periods where user_id = v_uid;
    else
      select sort_order + 1 into v_order from public.timeline_periods where id = p_after_period_id and user_id = v_uid;
      if v_order is null then
        raise exception 'NOT_FOUND' using detail = '기준 학기를 찾을 수 없습니다.';
      end if;
    end if;
    if (select count(*) from public.timeline_periods where user_id = v_uid) >= 40 then
      raise exception 'VALIDATION_ERROR' using detail = '학기는 40개까지 만들 수 있습니다.';
    end if;

    update public.timeline_periods set sort_order = sort_order + 1
      where user_id = v_uid and sort_order >= v_order;

    insert into public.timeline_periods (user_id, type, name, sort_order, request_id)
      values (v_uid, p_type, v_name, v_order, p_request_id)
      returning * into v_period;
    v_created := true;
  end if;

  return jsonb_build_object(
    'period', jsonb_build_object('id', v_period.id, 'type', v_period.type, 'name', v_period.name, 'sort_order', v_period.sort_order),
    'created', v_created,
    'periods', (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'type', p.type, 'name', p.name, 'sort_order', p.sort_order) order by p.sort_order), '[]'::jsonb)
      from public.timeline_periods p where p.user_id = v_uid
    )
  );
end;
$$;

revoke all on function public.insert_timeline_period(text, uuid, uuid, text) from public, anon;
grant execute on function public.insert_timeline_period(text, uuid, uuid, text) to authenticated;

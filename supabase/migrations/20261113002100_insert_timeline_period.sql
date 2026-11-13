-- 로드맵 학기 추가 (휴학 · 군휴학 · 교환학생)
-- - 기존 학기 사이 또는 맨 끝에 같은 수준의 타임라인 칸을 넣는다.
-- - 기존 학기의 id·이름은 그대로 두고 순서(sort_order)만 한 칸씩 뒤로 민다.
--   노드는 period_id로 학기에 붙어 있으므로 학기 안 위치·연결선·보관함은 바뀌지 않는다.
-- - 끼워 넣기와 순서 변경은 함수 하나(한 트랜잭션)에서 처리한다.
-- - 같은 요청 id(p_request_id)로 다시 부르면 새로 만들지 않고 처음 만든 학기를 돌려준다. (저장 버튼 반복 클릭)

-- 요청 id: 사용자별로 하나만 (기존 행은 null → 영향 없음)
alter table public.timeline_periods add column request_id uuid;
alter table public.timeline_periods
  add constraint timeline_periods_user_request_key unique (user_id, request_id);

-- p_type: 'leave'(휴학) | 'military'(군휴학) | 'exchange'(교환학생)
-- p_after_period_id: 이 학기 바로 뒤에 넣는다. null이면 맨 끝
-- 결과: { period, created, periods(내 학기 전체, 순서대로) }
create function public.insert_timeline_period(
  p_type text,
  p_after_period_id uuid default null,
  p_request_id uuid default null
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
  v_name := case p_type when 'leave' then '휴학' when 'military' then '군휴학' when 'exchange' then '교환학생' end;
  if v_name is null then
    raise exception 'VALIDATION_ERROR' using detail = '휴학·군휴학·교환학생만 추가할 수 있습니다.';
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
      -- 본인 학기만 기준으로 쓸 수 있다
      select sort_order + 1 into v_order from public.timeline_periods where id = p_after_period_id and user_id = v_uid;
      if v_order is null then
        raise exception 'NOT_FOUND' using detail = '기준 학기를 찾을 수 없습니다.';
      end if;
    end if;
    if (select count(*) from public.timeline_periods where user_id = v_uid) >= 40 then
      raise exception 'VALIDATION_ERROR' using detail = '학기는 40개까지 만들 수 있습니다.';
    end if;

    -- 뒤 학기들을 한 칸씩 민다 (순서 unique 제약은 트랜잭션 끝에 검사)
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

revoke all on function public.insert_timeline_period(text, uuid, uuid) from public, anon;
grant execute on function public.insert_timeline_period(text, uuid, uuid) to authenticated;

-- 로드맵 학기(기간) 삭제 RPC delete_timeline_period
-- 규칙 (SPEC 6.2, API 4.3)
-- - 학기를 지워도 노드·문서는 지우지 않는다: 그 학기에 배치된 노드(교과목·활동·메모 모두)는 보관함으로 옮긴다
--   (status 'stored', period_id null. 노드 id·문서·관계선·사진·첨부·위치 값은 그대로)
-- - 노드를 옮기고 → 학기를 지우고 → 남은 학기 순서(sort_order)를 0부터 다시 매기는 것을 한 트랜잭션(함수 하나)으로 한다
--   → 중간에 실패하면 전부 취소되어 일부만 지워지는 일이 없다
-- - 로그인한 본인 학기만 (auth.uid()). 이미 지워졌거나 없는 학기면 아무것도 바꾸지 않고 deleted=false (다시 불러도 안전)
-- - timeline_periods는 브라우저에서 직접 지울 수 없고(삭제 권한 없음) 이 함수로만 지운다
-- - 학기는 온보딩 완료 때 한 번만 만들어지므로(complete_onboarding은 다시 부르면 CONFLICT) 지운 학기가 다시 생기지 않는다

create function public.delete_timeline_period(p_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_moved uuid[] := '{}';
  v_deleted boolean := false;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using detail = '로그인이 필요합니다.';
  end if;
  if p_period_id is null then
    raise exception 'VALIDATION_ERROR' using detail = '삭제할 학기를 골라 주세요.';
  end if;

  -- 같은 사용자의 학기 추가·삭제는 한 번에 하나씩 (순서 계산이 겹치지 않게, insert_timeline_period와 같은 잠금)
  perform 1 from public.profiles where id = v_uid for update;

  if exists (select 1 from public.timeline_periods where id = p_period_id and user_id = v_uid) then
    -- 1) 이 학기의 노드를 보관함으로 (노드는 지우지 않는다)
    with moved as (
      update public.nodes
        set status = 'stored', period_id = null
        where user_id = v_uid and period_id = p_period_id
        returning id
    )
    select coalesce(array_agg(id), '{}') into v_moved from moved;

    -- 2) 학기 삭제 (이제 이 학기를 가리키는 노드가 없다)
    delete from public.timeline_periods where id = p_period_id and user_id = v_uid;
    v_deleted := true;

    -- 3) 남은 학기 순서를 빈칸 없이 0부터 다시 (user_id·sort_order 유일 제약은 트랜잭션 끝에 검사)
    update public.timeline_periods p
      set sort_order = r.new_order
      from (
        select id, (row_number() over (order by sort_order) - 1)::integer as new_order
        from public.timeline_periods where user_id = v_uid
      ) r
      where p.id = r.id and p.sort_order <> r.new_order;
  end if;

  return jsonb_build_object(
    'deleted', v_deleted,
    'moved_node_ids', to_jsonb(v_moved),
    'periods', (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'type', p.type, 'name', p.name, 'sort_order', p.sort_order) order by p.sort_order), '[]'::jsonb)
      from public.timeline_periods p where p.user_id = v_uid
    )
  );
end;
$$;

revoke all on function public.delete_timeline_period(uuid) from public, anon;
grant execute on function public.delete_timeline_period(uuid) to authenticated;

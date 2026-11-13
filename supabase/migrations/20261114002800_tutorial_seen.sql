-- HOME·로드맵 튜토리얼 최초 자동 실행 기록 (계정별, 기기·브라우저와 무관)
--
-- - profiles에 두 칸을 더한다: home_tutorial_seen, roadmap_tutorial_seen
-- - 기존 가입자: 두 칸 모두 true (새 기능이 생겼다고 튜토리얼을 자동으로 띄우지 않는다)
--   → 칸을 default true로 추가해서 이미 있는 행은 모두 true가 되게 하고,
-- - 신규 가입자: 그 다음 default를 false로 바꾼다 → 이후 가입 트리거(handle_new_user)가 만드는 행만 false
-- - 앱은 처음 자동으로 띄울 때 mark_tutorial_seen(kind)을 부른다 (건너뛰어도 완료). 한 번 true가 되면 되돌리지 않는다.
-- - 사용자가 직접 칸을 고치지 못하게 컬럼 권한은 주지 않고, 본인 행만 true로 바꾸는 RPC만 연다.
-- 기존 테이블·데이터·RLS는 바꾸지 않는다.

alter table public.profiles
  add column home_tutorial_seen boolean not null default true,
  add column roadmap_tutorial_seen boolean not null default true;

alter table public.profiles
  alter column home_tutorial_seen set default false,
  alter column roadmap_tutorial_seen set default false;

-- 튜토리얼 자동 실행을 완료로 기록 (kind: 'home' | 'roadmap')
create function public.mark_tutorial_seen(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using detail = '로그인이 필요합니다.';
  end if;
  if p_kind = 'home' then
    update public.profiles set home_tutorial_seen = true where id = v_uid;
  elsif p_kind = 'roadmap' then
    update public.profiles set roadmap_tutorial_seen = true where id = v_uid;
  else
    raise exception 'VALIDATION_ERROR' using detail = '알 수 없는 튜토리얼이에요.';
  end if;
  if not found then
    raise exception 'NOT_FOUND' using detail = '프로필이 없습니다.';
  end if;
  return jsonb_build_object('kind', p_kind, 'seen', true);
end;
$$;

revoke all on function public.mark_tutorial_seen(text) from public, anon;
grant execute on function public.mark_tutorial_seen(text) to authenticated;

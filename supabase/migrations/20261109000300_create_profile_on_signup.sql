-- TASKS 3-6: 가입 시 profiles 한 행 자동 생성 (docs/API.md 2장 User)
-- 최소 프로필만 만든다. 학기·펫은 온보딩 완료 RPC가 만든다. (SPEC 3장)
-- nickname은 비워 두고 온보딩에서 정한다.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer          -- RLS와 무관하게 profiles에 쓸 수 있도록 함수 소유자 권한으로 실행
set search_path = ''      -- 다른 스키마의 같은 이름 객체를 잘못 쓰지 않도록 고정
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;   -- 이미 있으면 다시 만들지 않음
  return new;
end;
$$;

-- 트리거 전용 함수: 로그인 사용자가 RPC로 직접 부를 수 없게 한다.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 이 migration 적용 전에 이미 만든 테스트 계정이 있으면 프로필을 채워 둔다.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

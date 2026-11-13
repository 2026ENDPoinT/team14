-- 사진 첨부 (로드맵 활동 노드 · 일기 공용)
-- - 원본 파일: 비공개 Storage 버킷 photos, 경로 '<user_id>/<node|diary>/<노드·일기 id>/<사진 id>.<확장자>'
-- - DB(photos 테이블): 사진 1장 = 행 1개. 노드 또는 일기 중 정확히 하나와 Storage 경로를 잇는다.
-- - 화면에 보여 줄 때만 서명 URL을 만들고, URL은 저장하지 않는다. (diaries.photo_urls는 쓰지 않음)
-- - 본인 것만: DB는 RLS, 파일은 Storage 정책(경로 첫 폴더 = 내 id)으로 막는다.
-- - 형식·크기: jpg·png·webp·gif, 장당 5MB, 노드·일기마다 최대 5장 (일기 화면 안내 '최대 5장'과 같게)

-- 일기도 (id, user_id) 쌍으로 연결할 수 있게 (id가 기본 키라 기존 데이터에 영향 없음)
alter table public.diaries add constraint diaries_id_user_key unique (id, user_id);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  node_id uuid,
  diary_id uuid,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  -- 같은 사용자의 노드·일기에만 붙는다. 노드·일기를 지우면 연결 행도 지워진다
  constraint photos_node_fkey foreign key (node_id, user_id) references public.nodes (id, user_id) on delete cascade,
  constraint photos_diary_fkey foreign key (diary_id, user_id) references public.diaries (id, user_id) on delete cascade,
  constraint photos_one_owner check (num_nonnulls(node_id, diary_id) = 1),
  -- 경로는 '<내 id>/node/<노드 id>/...' 또는 '<내 id>/diary/<일기 id>/...' 만
  constraint photos_path_check check (
    storage_path like user_id::text || '/' || case when node_id is not null then 'node/' || node_id::text else 'diary/' || diary_id::text end || '/%'
  )
);
create index photos_node_idx on public.photos (node_id) where node_id is not null;
create index photos_diary_idx on public.photos (diary_id) where diary_id is not null;

-- 노드·일기마다 최대 5장
create function public.photos_check_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.photos
      where (new.node_id is not null and node_id = new.node_id)
         or (new.diary_id is not null and diary_id = new.diary_id)) >= 5 then
    raise exception 'VALIDATION_ERROR' using detail = '사진은 5장까지 올릴 수 있습니다.';
  end if;
  return new;
end;
$$;
create trigger photos_limit before insert on public.photos
  for each row execute function public.photos_check_limit();

alter table public.photos enable row level security;
grant select, delete on public.photos to authenticated;
grant insert (node_id, diary_id, storage_path) on public.photos to authenticated;

create policy photos_select_own on public.photos
  for select to authenticated using (user_id = (select auth.uid()));
create policy photos_insert_own on public.photos
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy photos_delete_own on public.photos
  for delete to authenticated using (user_id = (select auth.uid()));

-- Storage: 비공개 버킷 (이미 있으면 그대로 둔다)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- 파일 읽기·올리기·지우기: 경로 첫 폴더가 내 id인 파일만 (덮어쓰기(update) 정책은 두지 않음)
create policy photos_objects_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy photos_objects_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy photos_objects_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

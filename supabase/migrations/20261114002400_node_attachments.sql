-- 로드맵 활동 노드 첨부: 링크 · 파일
-- - 링크: http·https 주소만 (최대 2000자), 노드당 10개
-- - 파일: 비공개 Storage 버킷 attachments, 경로 '<user_id>/node/<노드 id>/<첨부 id>.<확장자>'
--         장당 5MB, 노드당 5개. 문서·이미지·압축 파일만 (실행 파일 등은 버킷 형식 제한으로 막힘)
--         내려받을 때만 서명 URL을 만든다 (저장하지 않음)
-- - 본인 것만: DB는 RLS, 파일은 Storage 정책(경로 첫 폴더 = 내 id)
-- - 기존 노드 사진(photos 테이블·photos 버킷)은 그대로 둔다

create table public.node_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  node_id uuid not null,
  kind text not null check (kind in ('link', 'file')),
  name text not null check (char_length(name) between 1 and 200),
  url text,
  storage_path text unique,
  content_type text,
  size_bytes integer check (size_bytes is null or size_bytes between 0 and 5242880),
  created_at timestamptz not null default now(),
  constraint node_attachments_node_fkey foreign key (node_id, user_id) references public.nodes (id, user_id) on delete cascade,
  constraint node_attachments_shape_check check (
    (kind = 'link' and url ~* '^https?://[^[:space:]]+$' and char_length(url) <= 2000 and storage_path is null)
    or (kind = 'file' and url is null and storage_path like user_id::text || '/node/' || node_id::text || '/%')
  )
);
create index node_attachments_node_idx on public.node_attachments (node_id);

-- 노드마다 파일 5개, 링크 10개까지
create function public.node_attachments_check_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_max integer := case when new.kind = 'file' then 5 else 10 end;
begin
  if (select count(*) from public.node_attachments where node_id = new.node_id and kind = new.kind) >= v_max then
    raise exception 'VALIDATION_ERROR' using detail = case when new.kind = 'file'
      then '파일은 활동마다 5개까지 첨부할 수 있습니다.' else '링크는 활동마다 10개까지 추가할 수 있습니다.' end;
  end if;
  return new;
end;
$$;
create trigger node_attachments_limit before insert on public.node_attachments
  for each row execute function public.node_attachments_check_limit();

alter table public.node_attachments enable row level security;
grant select, delete on public.node_attachments to authenticated;
grant insert (node_id, kind, name, url, storage_path, content_type, size_bytes) on public.node_attachments to authenticated;

create policy node_attachments_select_own on public.node_attachments
  for select to authenticated using (user_id = (select auth.uid()));
create policy node_attachments_insert_own on public.node_attachments
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy node_attachments_delete_own on public.node_attachments
  for delete to authenticated using (user_id = (select auth.uid()));

-- Storage: 비공개 버킷 (이미 있으면 그대로)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 5242880, array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/x-hwp',
  'application/vnd.hancom.hwpx',
  'text/plain',
  'text/markdown',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/zip'
])
on conflict (id) do nothing;

create policy attachments_objects_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy attachments_objects_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy attachments_objects_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

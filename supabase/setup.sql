-- RENUNGAN EL-BETHEL — Supabase schema + secure browser access
-- Run in the SQL Editor of the SEPARATE 'ehop-renungan' project only.
-- Bucket 'renungan-publik' must exist and be public.
-- For uploaded cover JPG/PNG/WEBP, enable those MIME types in the bucket.

create table if not exists public.renungan_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.renungan_editions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) between 2 and 160),
  theme text not null default '',
  edition_year integer not null check (edition_year between 2020 and 2200),
  edition_month integer not null check (edition_month between 1 and 12),
  pdf_path text not null check (length(trim(pdf_path)) > 4),
  cover_path text,
  page_count integer check (page_count is null or page_count between 1 and 5000),
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (edition_year, edition_month)
);

create or replace function public.renungan_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists renungan_editions_touch on public.renungan_editions;
create trigger renungan_editions_touch before update on public.renungan_editions
for each row execute function public.renungan_touch_updated_at();

-- SECURITY DEFINER reads admin membership without exposing the membership table.
create or replace function public.is_renungan_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.renungan_admins a
    where a.user_id = (select auth.uid())
  );
$$;

revoke all on public.renungan_admins from anon, authenticated;
revoke all on public.renungan_editions from anon, authenticated;
grant select on public.renungan_admins to authenticated;
grant select on public.renungan_editions to anon, authenticated;
grant insert, update, delete on public.renungan_editions to authenticated;

revoke execute on function public.is_renungan_admin() from public, anon;
grant execute on function public.is_renungan_admin() to authenticated;

alter table public.renungan_admins enable row level security;
alter table public.renungan_editions enable row level security;

drop policy if exists renungan_admins_read_self on public.renungan_admins;
create policy renungan_admins_read_self on public.renungan_admins
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists renungan_editions_public_read on public.renungan_editions;
create policy renungan_editions_public_read on public.renungan_editions
for select to anon, authenticated using (is_published = true);

drop policy if exists renungan_editions_admin_read on public.renungan_editions;
create policy renungan_editions_admin_read on public.renungan_editions
for select to authenticated using ((select public.is_renungan_admin()));

drop policy if exists renungan_editions_admin_insert on public.renungan_editions;
create policy renungan_editions_admin_insert on public.renungan_editions
for insert to authenticated with check ((select public.is_renungan_admin()));

drop policy if exists renungan_editions_admin_update on public.renungan_editions;
create policy renungan_editions_admin_update on public.renungan_editions
for update to authenticated
using ((select public.is_renungan_admin()))
with check ((select public.is_renungan_admin()));

drop policy if exists renungan_editions_admin_delete on public.renungan_editions;
create policy renungan_editions_admin_delete on public.renungan_editions
for delete to authenticated using ((select public.is_renungan_admin()));

-- Public bucket means anyone with the asset URL can READ the PDF;
-- these Storage RLS policies permit WRITES only by explicit renungan admins.
drop policy if exists renungan_files_admin_insert on storage.objects;
create policy renungan_files_admin_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'renungan-publik' and (select public.is_renungan_admin()));

drop policy if exists renungan_files_admin_select on storage.objects;
create policy renungan_files_admin_select on storage.objects
for select to authenticated
using (bucket_id = 'renungan-publik' and (select public.is_renungan_admin()));

drop policy if exists renungan_files_admin_update on storage.objects;
create policy renungan_files_admin_update on storage.objects
for update to authenticated
using (bucket_id = 'renungan-publik' and (select public.is_renungan_admin()))
with check (bucket_id = 'renungan-publik' and (select public.is_renungan_admin()));

drop policy if exists renungan_files_admin_delete on storage.objects;
create policy renungan_files_admin_delete on storage.objects
for delete to authenticated
using (bucket_id = 'renungan-publik' and (select public.is_renungan_admin()));

-- IMPORTANT: Admin assignment is a separate, manual privileged action.
-- After making an Auth user in Authentication > Users, run this in SQL Editor:
-- insert into public.renungan_admins (user_id)
-- values ('PASTE_AUTH_USER_UUID_HERE') on conflict (user_id) do nothing;

create table if not exists public.podcast_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.podcast_episodes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null, description text not null default '', guest_name text not null default '', guest_bio text not null default '', guest_links jsonb not null default '[]'::jsonb,
  youtube_url text, media_url text, media_kind text check (media_kind in ('audio','video')),
  transcript text not null default '', article text not null default '', meta_description text not null default '',
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.podcast_guest_submissions (
  id uuid primary key default gen_random_uuid(), name text not null, email text not null,
  pronouns text, pronunciation text, bio text not null, organization text, role_title text,
  website text, offer_url text, social_links text, headshot_path text,
  product_name text, community_impact text, revenue_model text, origin_story text,
  hard_lesson text, surprising_fact text, discussion_topics text,
  permission_headshot boolean not null default false, permission_links boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists podcast_episodes_status_date on public.podcast_episodes(status,published_at desc);
alter table public.podcast_admins enable row level security;
alter table public.podcast_episodes enable row level security;
alter table public.podcast_guest_submissions enable row level security;
create policy "Admin self" on public.podcast_admins for select to authenticated using (user_id = (select auth.uid()));
create policy "Published episodes or admin" on public.podcast_episodes for select to anon, authenticated using (status = 'published' or exists (select 1 from public.podcast_admins where user_id = (select auth.uid())));
create policy "Admin insert episode" on public.podcast_episodes for insert to authenticated with check (exists (select 1 from public.podcast_admins where user_id = (select auth.uid())));
create policy "Admin update episode" on public.podcast_episodes for update to authenticated using (exists (select 1 from public.podcast_admins where user_id = (select auth.uid()))) with check (exists (select 1 from public.podcast_admins where user_id = (select auth.uid())));
create policy "Admin delete episode" on public.podcast_episodes for delete to authenticated using (exists (select 1 from public.podcast_admins where user_id = (select auth.uid())));
create policy "Admin read submissions" on public.podcast_guest_submissions for select to authenticated using (exists (select 1 from public.podcast_admins where user_id = (select auth.uid())));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values
('podcast-media','podcast-media',true,524288000,array['audio/mpeg','audio/mp4','audio/wav','audio/ogg','video/mp4','video/webm'])
on conflict (id) do nothing;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values
('podcast-headshots','podcast-headshots',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy "Admin uploads media" on storage.objects for insert to authenticated with check (bucket_id='podcast-media' and exists (select 1 from public.podcast_admins where user_id = (select auth.uid())));
create policy "Admin manages media" on storage.objects for delete to authenticated using (bucket_id='podcast-media' and exists (select 1 from public.podcast_admins where user_id = (select auth.uid())));
create policy "Admin reads headshots" on storage.objects for select to authenticated using (bucket_id='podcast-headshots' and exists (select 1 from public.podcast_admins where user_id = (select auth.uid())));

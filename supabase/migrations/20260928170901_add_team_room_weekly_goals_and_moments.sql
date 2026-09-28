create table public.team_room_weeks (
 week_start date primary key check (extract(isodow from week_start)=1),
 title text not null check (char_length(title) between 1 and 100),
 description text not null default '' check (char_length(description)<=500),
 metric text not null default 'assists' check (metric in ('assists','goals','wins','manual')),
 target integer not null default 10 check (target between 1 and 10000),
 manual_progress integer not null default 0 check (manual_progress between 0 and 10000),
 featured_player_id uuid references public.players(id) on delete set null,
 featured_note text not null default '' check (char_length(featured_note)<=500)
);
create table public.team_room_moments (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(title) between 1 and 100),
 caption text not null default '' check (char_length(caption)<=1000),
 media_path text,
 media_type text check (media_type in ('image','video')),
 video_url text check (video_url is null or video_url ~ '^https://'),
 archived boolean not null default false,
 created_at timestamptz not null default now(),
 check ((media_path is null and media_type is null) or (media_path is not null and media_type is not null)),
 check (media_path is null or video_url is null)
);
alter table public.team_room_weeks enable row level security;
alter table public.team_room_moments enable row level security;
revoke all on public.team_room_weeks, public.team_room_moments from anon,authenticated;
grant select,insert,update on public.team_room_weeks,public.team_room_moments to authenticated;
create policy team_room_weeks_read on public.team_room_weeks for select to authenticated using ((exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin') or exists (select 1 from public.player_accounts where user_id=(select auth.uid()))));
create policy team_room_weeks_insert on public.team_room_weeks for insert to authenticated with check (exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create policy team_room_weeks_update on public.team_room_weeks for update to authenticated using (exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin')) with check (exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create policy team_room_moments_read on public.team_room_moments for select to authenticated using (((exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin') or exists (select 1 from public.player_accounts where user_id=(select auth.uid()))) and not archived) or exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create policy team_room_moments_insert on public.team_room_moments for insert to authenticated with check (exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create policy team_room_moments_update on public.team_room_moments for update to authenticated using (exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin')) with check (exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create index team_room_moments_created_idx on public.team_room_moments(created_at desc);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('team-room-media','team-room-media',false,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/webm']);
create policy team_room_media_read on storage.objects for select to authenticated using
(bucket_id='team-room-media' and (exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin') or ((exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin') or exists (select 1 from public.player_accounts where user_id=(select auth.uid()))) and exists(select 1 from public.team_room_moments m where m.media_path=name and not m.archived))));
create policy team_room_media_upload on storage.objects for insert to authenticated with check (bucket_id='team-room-media' and exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create policy team_room_media_cleanup on storage.objects for delete to authenticated using (bucket_id='team-room-media' and exists (select 1 from public.profiles where id=(select auth.uid()) and role='admin'));

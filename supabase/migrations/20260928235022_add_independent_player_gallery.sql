-- Independent gallery. No changes to voting, players, matches or existing buckets.
create table public.player_gallery (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  created_by uuid not null default auth.uid(),
  type text not null check (type in ('image','video')),
  file_path text not null unique,
  thumbnail_path text,
  extension text not null check (extension in ('jpg','png','webp','gif','mp4','webm','mov')),
  duration numeric check (duration > 0 and duration <= 60),
  title text not null check (length(trim(title)) between 1 and 120),
  description text not null default '' check (length(description) <= 2000),
  category text not null default 'ALTRO' check (category in ('MOMENTO','GOL','TROFEO','MATCH','SCREENSHOT','FUN','PLAYER','CREATIVE','VIDEO','ALTRO')),
  status text not null default 'draft' check (status in ('draft','ready')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((type='video' and duration is not null and extension in ('mp4','webm','mov')) or (type='image' and duration is null and extension in ('jpg','png','webp','gif')))
);
create index player_gallery_player_date on public.player_gallery(player_id,created_at desc);
create index player_gallery_author on public.player_gallery(created_by);
alter table public.player_gallery enable row level security;

create function private.gallery_admin() returns boolean language sql stable security invoker set search_path='' as $$
select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin');
$$;
create function private.gallery_member() returns boolean language sql stable security invoker set search_path='' as $$
select private.gallery_admin() or exists(select 1 from public.player_accounts where user_id=(select auth.uid()));
$$;
create function private.gallery_owns(target uuid, author uuid) returns boolean language sql stable security invoker set search_path='' as $$
select private.gallery_admin() or (author=(select auth.uid()) and exists(select 1 from public.player_accounts where user_id=(select auth.uid()) and player_id=target));
$$;
revoke all on function private.gallery_admin(), private.gallery_member(), private.gallery_owns(uuid,uuid) from public;
grant execute on function private.gallery_admin(), private.gallery_member(), private.gallery_owns(uuid,uuid) to authenticated;
grant usage on schema private to authenticated;

create function private.guard_player_gallery() returns trigger language plpgsql security invoker set search_path='' as $$
declare own_player uuid;
begin
  if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
  if TG_OP='INSERT' then
    if not private.gallery_admin() then
      select player_id into own_player from public.player_accounts where user_id=auth.uid();
      if own_player is null then raise exception 'Profilo giocatore richiesto'; end if;
      if new.player_id is not null and new.player_id<>own_player then raise exception 'Gallery non tua'; end if;
      new.player_id:=own_player;
    end if;
    new.created_by:=auth.uid();
    new.created_at:=now();
    new.status:='draft';
    new.file_path:=new.player_id::text||'/'||new.id::text||'/original.'||new.extension;
    new.thumbnail_path:=case when new.type='video' then new.player_id::text||'/'||new.id::text||'/preview.jpg' else null end;
  else
    if (new.id,new.player_id,new.created_by,new.file_path,new.thumbnail_path,new.extension,new.type,new.duration,new.created_at)
       is distinct from (old.id,old.player_id,old.created_by,old.file_path,old.thumbnail_path,old.extension,old.type,old.duration,old.created_at)
    then raise exception 'Proprietario e file non modificabili'; end if;
  end if;
  new.updated_at:=now();
  return new;
end;
$$;
revoke all on function private.guard_player_gallery() from public;
create trigger guard_player_gallery before insert or update on public.player_gallery for each row execute function private.guard_player_gallery();
grant select,insert,update,delete on public.player_gallery to authenticated;
revoke all on public.player_gallery from anon;
create policy gallery_read on public.player_gallery for select to authenticated using ((select private.gallery_member()) and (status='ready' or private.gallery_owns(player_id,created_by)));
create policy gallery_insert on public.player_gallery for insert to authenticated with check (private.gallery_owns(player_id,created_by));
create policy gallery_update on public.player_gallery for update to authenticated using (private.gallery_owns(player_id,created_by)) with check (private.gallery_owns(player_id,created_by));
create policy gallery_delete on public.player_gallery for delete to authenticated using (private.gallery_owns(player_id,created_by));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('player-gallery','player-gallery',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']);
create policy gallery_files_read on storage.objects for select to authenticated using (
 bucket_id='player-gallery' and (select private.gallery_member()) and exists(select 1 from public.player_gallery g where (g.file_path=name or g.thumbnail_path=name) and (g.status='ready' or private.gallery_owns(g.player_id,g.created_by))));
create policy gallery_files_insert on storage.objects for insert to authenticated with check (
 bucket_id='player-gallery' and exists(select 1 from public.player_gallery g where (g.file_path=name or g.thumbnail_path=name) and g.status='draft' and private.gallery_owns(g.player_id,g.created_by)));
create policy gallery_files_delete on storage.objects for delete to authenticated using (
 bucket_id='player-gallery' and exists(select 1 from public.player_gallery g where (g.file_path=name or g.thumbnail_path=name) and private.gallery_owns(g.player_id,g.created_by)));
-- No UPDATE policy: uploaded files cannot be overwritten or moved into another gallery.


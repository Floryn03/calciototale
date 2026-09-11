-- Storico Partite: risultato, avversario, MVP e cartellini.
-- Le letture sono per utenti autenticati; modifiche solo Admin.

create table if not exists public.match_reports (
  match_id uuid primary key references public.events(id) on delete cascade,
  opponent text not null check (char_length(trim(opponent)) between 1 and 120),
  team_score integer not null default 0 check (team_score between 0 and 99),
  opponent_score integer not null default 0 check (opponent_score between 0 and 99),
  note text check (note is null or char_length(note) <= 1000),
  match_mvp_player_id uuid references public.players(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.match_reports
  add column if not exists match_mvp_player_id uuid references public.players(id) on delete set null;

create table if not exists public.match_player_discipline (
  match_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  yellow_cards smallint not null default 0 check (yellow_cards between 0 and 9),
  red_cards smallint not null default 0 check (red_cards between 0 and 9),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create index if not exists match_reports_updated_at_idx on public.match_reports(updated_at desc);
create index if not exists match_player_discipline_match_idx on public.match_player_discipline(match_id);

alter table public.match_reports enable row level security;
alter table public.match_player_discipline enable row level security;

grant select on public.match_reports, public.match_player_discipline to authenticated;
grant insert, update, delete on public.match_reports, public.match_player_discipline to authenticated;

drop policy if exists "match_reports_select_authenticated" on public.match_reports;
create policy "match_reports_select_authenticated" on public.match_reports for select to authenticated using (true);
drop policy if exists "match_reports_insert_admin" on public.match_reports;
create policy "match_reports_insert_admin" on public.match_reports for insert to authenticated with check (exists (select 1 from public.profiles where profiles.id=(select auth.uid()) and profiles.role='admin'));
drop policy if exists "match_reports_update_admin" on public.match_reports;
create policy "match_reports_update_admin" on public.match_reports for update to authenticated using (exists (select 1 from public.profiles where profiles.id=(select auth.uid()) and profiles.role='admin')) with check (exists (select 1 from public.profiles where profiles.id=(select auth.uid()) and profiles.role='admin'));
drop policy if exists "match_reports_delete_admin" on public.match_reports;
create policy "match_reports_delete_admin" on public.match_reports for delete to authenticated using (exists (select 1 from public.profiles where profiles.id=(select auth.uid()) and profiles.role='admin'));

drop policy if exists "match_player_discipline_select_authenticated" on public.match_player_discipline;
create policy "match_player_discipline_select_authenticated" on public.match_player_discipline for select to authenticated using (true);
drop policy if exists "match_player_discipline_insert_admin" on public.match_player_discipline;
create policy "match_player_discipline_insert_admin" on public.match_player_discipline for insert to authenticated with check (exists (select 1 from public.profiles where profiles.id=(select auth.uid()) and profiles.role='admin'));
drop policy if exists "match_player_discipline_update_admin" on public.match_player_discipline;
create policy "match_player_discipline_update_admin" on public.match_player_discipline for update to authenticated using (exists (select 1 from public.profiles where profiles.id=(select auth.uid()) and profiles.role='admin')) with check (exists (select 1 from public.profiles where profiles.id=(select auth.uid()) and profiles.role='admin'));
drop policy if exists "match_player_discipline_delete_admin" on public.match_player_discipline;
create policy "match_player_discipline_delete_admin" on public.match_player_discipline for delete to authenticated using (exists (select 1 from public.profiles where profiles.id=(select auth.uid()) and profiles.role='admin'));
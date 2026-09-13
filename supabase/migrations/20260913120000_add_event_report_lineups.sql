-- Referto partita dentro Eventi: ruoli della singola partita e riconoscimento MVS.
-- Non modifica i ruoli fissi dei giocatori né le votazioni esistenti.

alter table public.match_reports
  add column if not exists match_mvs_player_id uuid references public.players(id) on delete set null;

create table if not exists public.event_report_lineups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  slot_order smallint not null check (slot_order between 1 and 10),
  position text not null check (position in ('POR', 'DCC', 'DCS', 'DCD', 'CDC', 'CCS', 'CCD', 'ES', 'ED', 'ATT')),
  player_id uuid references public.players(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (event_id, slot_order)
);

create index if not exists event_report_lineups_event_id_idx
  on public.event_report_lineups(event_id, slot_order);

alter table public.event_report_lineups enable row level security;

grant select on public.event_report_lineups to authenticated;
grant insert, update, delete on public.event_report_lineups to authenticated;

drop policy if exists "event_report_lineups_select_authenticated" on public.event_report_lineups;
create policy "event_report_lineups_select_authenticated"
  on public.event_report_lineups for select to authenticated using (true);

drop policy if exists "event_report_lineups_insert_admin" on public.event_report_lineups;
create policy "event_report_lineups_insert_admin"
  on public.event_report_lineups for insert to authenticated
  with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin'));

drop policy if exists "event_report_lineups_update_admin" on public.event_report_lineups;
create policy "event_report_lineups_update_admin"
  on public.event_report_lineups for update to authenticated
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin'));

drop policy if exists "event_report_lineups_delete_admin" on public.event_report_lineups;
create policy "event_report_lineups_delete_admin"
  on public.event_report_lineups for delete to authenticated
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin'));

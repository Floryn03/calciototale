-- Torneo Serale: tre gironi con classifiche indipendenti.

alter table public.competition_matches
  add column if not exists group_name text;

alter table public.competition_matches
  drop constraint if exists competition_matches_group_name_check;
alter table public.competition_matches
  add constraint competition_matches_group_name_check check (
    group_name is null or group_name in ('Girone 1', 'Girone 2', 'Girone 3')
  );

alter table public.competition_teams
  drop constraint if exists competition_teams_group_name_check;
alter table public.competition_teams
  add constraint competition_teams_group_name_check check (
    group_name is null or group_name in ('Girone 1', 'Girone 2', 'Girone 3')
  );

create index if not exists competition_matches_group_idx
  on public.competition_matches(competition_id, group_name, round_number);

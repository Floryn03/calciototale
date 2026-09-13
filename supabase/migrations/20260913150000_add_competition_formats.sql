-- Competizioni: campionati ufficiali con andata/ritorno e Torneo Serale a fasi.

alter table public.competitions
  add column if not exists competition_area text,
  add column if not exists format text not null default 'Campionato',
  add column if not exists double_round boolean not null default false;

alter table public.competitions
  drop constraint if exists competitions_area_check;
alter table public.competitions
  add constraint competitions_area_check check (
    competition_area is null or competition_area in ('ELUDO', 'VPG', 'VPC', 'PROCLUBBER', 'LND', 'ALLSTARS', 'VPL', 'FVPA', 'TORNEO_SERALE')
  );

alter table public.competitions
  drop constraint if exists competitions_format_check;
alter table public.competitions
  add constraint competitions_format_check check (format in ('Campionato', 'Torneo Serale'));

alter table public.competition_matches
  add column if not exists phase text not null default 'Girone';

alter table public.competition_matches
  drop constraint if exists competition_matches_phase_check;
alter table public.competition_matches
  add constraint competition_matches_phase_check check (phase in ('Andata', 'Ritorno', 'Girone', 'Sedicesimi', 'Ottavi', 'Quarti', 'Semifinale', 'Finale'));

create index if not exists competition_matches_competition_phase_round_idx
  on public.competition_matches(competition_id, phase, round_number);

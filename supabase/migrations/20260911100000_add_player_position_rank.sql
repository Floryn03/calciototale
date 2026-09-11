-- Gerarchia visuale del giocatore dentro il suo ruolo originario.
alter table public.players
  add column if not exists position_rank integer not null default 999;

alter table public.players
  drop constraint if exists players_position_rank_valid;

alter table public.players
  add constraint players_position_rank_valid
  check (position_rank between 1 and 999);

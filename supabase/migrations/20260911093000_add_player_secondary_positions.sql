-- Ruoli alternativi di schieramento: separati dal ruolo originario del giocatore.
alter table public.players
  add column if not exists secondary_positions text[] not null default '{}'::text[];

alter table public.players
  drop constraint if exists players_secondary_positions_valid;

alter table public.players
  add constraint players_secondary_positions_valid
  check (
    cardinality(secondary_positions) <= 3
    and secondary_positions <@ array[
      'POR', 'DCD', 'DCC', 'DCS', 'ES', 'ED',
      'CCS', 'CDC', 'CCD', 'ATT (PS)', 'ATT (PD)'
    ]::text[]
  );

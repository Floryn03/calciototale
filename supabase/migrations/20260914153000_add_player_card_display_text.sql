alter table public.player_cards
  add column if not exists display_name text null,
  add column if not exists display_id text null;

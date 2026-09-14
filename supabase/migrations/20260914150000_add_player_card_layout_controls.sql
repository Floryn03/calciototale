alter table public.player_cards
  add column if not exists layout jsonb not null default '{}'::jsonb;

create table if not exists public.match_player_stats (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  goals integer not null default 0 check (goals >= 0 and goals <= 99),
  assists integer not null default 0 check (assists >= 0 and assists <= 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, player_id)
);

create index if not exists match_player_stats_player_id_idx
  on public.match_player_stats(player_id);

alter table public.match_player_stats enable row level security;

create policy match_player_stats_select_public
  on public.match_player_stats
  for select
  to anon, authenticated
  using (true);
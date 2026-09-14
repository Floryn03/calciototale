create table if not exists public.archived_match_history (
  id uuid primary key default gen_random_uuid(),
  original_event_id uuid not null unique,
  event_name text not null,
  event_date date not null,
  event_time time,
  opponent text not null,
  team_score integer not null default 0,
  opponent_score integer not null default 0,
  note text,
  match_mvp_player_id uuid,
  match_mvs_player_id uuid,
  player_rows jsonb not null default '[]'::jsonb,
  archived_at timestamptz not null default now()
);

alter table public.archived_match_history enable row level security;

create policy archived_match_history_select_authenticated
on public.archived_match_history for select
to authenticated
using (true);

create policy archived_match_history_delete_admin
on public.archived_match_history for delete
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

create or replace function public.archive_event_match_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_report record;
  saved_rows jsonb;
begin
  select * into saved_report from public.match_reports where match_id = old.id;
  if not found then return old; end if;

  with player_ids as (
    select player_id from public.event_report_lineups where event_id = old.id and player_id is not null
    union select player_id from public.match_ratings where match_id = old.id
    union select player_id from public.match_player_stats where match_id = old.id
    union select player_id from public.match_player_discipline where match_id = old.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'player_id', ids.player_id, 'role', lineup.position, 'rating', rating.rating,
    'goals', coalesce(stats.goals, 0), 'assists', coalesce(stats.assists, 0),
    'yellow', coalesce(discipline.yellow_cards, 0), 'red', coalesce(discipline.red_cards, 0)
  order by ids.player_id), '[]'::jsonb)
  into saved_rows
  from player_ids ids
  left join lateral (
    select position from public.event_report_lineups
    where event_id = old.id and player_id = ids.player_id
    order by slot_order limit 1
  ) lineup on true
  left join public.match_ratings rating on rating.match_id = old.id and rating.player_id = ids.player_id
  left join public.match_player_stats stats on stats.match_id = old.id and stats.player_id = ids.player_id
  left join public.match_player_discipline discipline on discipline.match_id = old.id and discipline.player_id = ids.player_id;

  insert into public.archived_match_history (
    original_event_id, event_name, event_date, event_time, opponent, team_score, opponent_score,
    note, match_mvp_player_id, match_mvs_player_id, player_rows
  ) values (
    old.id, old.name, old.event_date, old.event_time, saved_report.opponent,
    saved_report.team_score, saved_report.opponent_score, saved_report.note,
    saved_report.match_mvp_player_id, saved_report.match_mvs_player_id, saved_rows
  )
  on conflict (original_event_id) do update set
    event_name = excluded.event_name, event_date = excluded.event_date, event_time = excluded.event_time,
    opponent = excluded.opponent, team_score = excluded.team_score, opponent_score = excluded.opponent_score,
    note = excluded.note, match_mvp_player_id = excluded.match_mvp_player_id,
    match_mvs_player_id = excluded.match_mvs_player_id, player_rows = excluded.player_rows, archived_at = now();

  return old;
end;
$$;

drop trigger if exists archive_event_match_history_before_delete on public.events;
create trigger archive_event_match_history_before_delete
before delete on public.events
for each row execute function public.archive_event_match_history();

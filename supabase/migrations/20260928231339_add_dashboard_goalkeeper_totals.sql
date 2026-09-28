-- Public, read-only season totals, matching the existing dashboard awards API.
-- The private definer exposes only player names and aggregate counts, never raw reports.
create or replace function private.dashboard_goalkeeper_totals()
returns table(player_id uuid, player_name text, matches_played bigint, clean_sheets bigint)
language sql stable security definer set search_path = ''
as $function$
  with live_games as (
    select distinct l.player_id, r.match_id, r.opponent_score
    from public.event_report_lineups l
    join public.match_reports r on r.match_id = l.event_id
    where l.position = 'POR' and l.player_id is not null
      and exists (select 1 from public.match_ratings v
        where v.match_id = l.event_id and v.player_id = l.player_id and v.rating is not null)
  ), archived_games as (
    select distinct (j->>'player_id')::uuid as player_id,
      a.original_event_id as match_id, a.opponent_score
    from public.archived_match_history a
    cross join lateral jsonb_array_elements(a.player_rows::jsonb) j
    where j->>'role' = 'POR' and nullif(j->>'player_id', '') is not null
      and nullif(j->>'rating', '') is not null
      and not exists (select 1 from public.match_reports r where r.match_id = a.original_event_id)
  ), games as (
    select * from live_games union all select * from archived_games
  )
  select p.id, p.name::text, count(*)::bigint,
    count(*) filter (where g.opponent_score = 0)::bigint
  from games g join public.players p on p.id = g.player_id
  group by p.id, p.name
  order by count(*) desc, count(*) filter (where g.opponent_score = 0) desc, p.name, p.id;
$function$;
revoke all on function private.dashboard_goalkeeper_totals() from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.dashboard_goalkeeper_totals() to anon, authenticated;

create or replace function public.dashboard_goalkeeper_totals()
returns table(player_id uuid, player_name text, matches_played bigint, clean_sheets bigint)
language sql stable security invoker set search_path = ''
as $function$ select * from private.dashboard_goalkeeper_totals(); $function$;
revoke all on function public.dashboard_goalkeeper_totals() from public;
grant execute on function public.dashboard_goalkeeper_totals() to anon, authenticated;

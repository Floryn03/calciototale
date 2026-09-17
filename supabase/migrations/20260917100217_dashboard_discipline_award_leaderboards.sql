-- Public Dashboard totals only; no report details or write access.
create or replace function private.dashboard_award_totals()
returns table(player_id uuid, player_name text, yellow bigint, red bigint, mvp bigint, mvs bigint)
language sql stable security definer set search_path = ''
as $$
  with archived as (
    select a.* from public.archived_match_history a
    where not exists (select 1 from public.match_reports r where r.match_id = a.original_event_id)
  ), contributions as (
    select d.player_id, coalesce(d.yellow_cards,0)::bigint as yellow,
      coalesce(d.red_cards,0)::bigint as red, 0::bigint as mvp, 0::bigint as mvs
    from public.match_player_discipline d
    join public.match_reports r on r.match_id = d.match_id
    union all
    select r.match_mvp_player_id,0,0,1,0 from public.match_reports r where r.match_mvp_player_id is not null
    union all
    select r.match_mvs_player_id,0,0,0,1 from public.match_reports r where r.match_mvs_player_id is not null
    union all
    select (j->>'player_id')::uuid,coalesce((j->>'yellow')::bigint,0),
      coalesce((j->>'red')::bigint,0),0,0
    from archived a cross join lateral jsonb_array_elements(a.player_rows::jsonb) j
    where j->>'player_id' is not null
    union all
    select a.match_mvp_player_id,0,0,1,0 from archived a where a.match_mvp_player_id is not null
    union all
    select a.match_mvs_player_id,0,0,0,1 from archived a where a.match_mvs_player_id is not null
  )
  select p.id,p.name::text,sum(c.yellow)::bigint,sum(c.red)::bigint,sum(c.mvp)::bigint,sum(c.mvs)::bigint
  from contributions c join public.players p on p.id=c.player_id
  group by p.id,p.name
  having sum(c.yellow)>0 or sum(c.red)>0 or sum(c.mvp)>0 or sum(c.mvs)>0;
$$;
revoke all on function private.dashboard_award_totals() from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.dashboard_award_totals() to anon, authenticated;
create or replace function public.dashboard_award_totals()
returns table(player_id uuid, player_name text, yellow bigint, red bigint, mvp bigint, mvs bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.dashboard_award_totals(); $$;
revoke all on function public.dashboard_award_totals() from public;
grant execute on function public.dashboard_award_totals() to anon, authenticated;

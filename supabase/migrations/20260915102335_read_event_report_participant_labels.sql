create schema if not exists private;

create or replace function private.event_report_player_labels(p_event_id uuid)
returns table (id uuid, name text, psn_id text)
language sql stable security definer
set search_path = ''
as $$
  select distinct p.id, p.name::text, p.psn_id::text
  from public.event_report_lineups l
  join public.players p on p.id = l.player_id
  where l.event_id = p_event_id
    and (select auth.uid()) is not null
    and (
      exists (select 1 from public.player_accounts a where a.user_id = (select auth.uid()))
      or exists (select 1 from public.profiles pr where pr.id = (select auth.uid()) and pr.role = 'admin')
    );
$$;
revoke all on function private.event_report_player_labels(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.event_report_player_labels(uuid) to authenticated;

create or replace function public.event_report_player_labels(p_event_id uuid)
returns table (id uuid, name text, psn_id text)
language sql stable security invoker
set search_path = ''
as $$
  select * from private.event_report_player_labels(p_event_id);
$$;
revoke all on function public.event_report_player_labels(uuid) from public, anon;
grant execute on function public.event_report_player_labels(uuid) to authenticated;

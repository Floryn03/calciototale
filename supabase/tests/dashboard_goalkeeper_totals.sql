-- Read-only fixtures: ordering, duplicate votes/lineups, drafts, roles, archives.
with
fixture_players(id,name) as (values
('00000000-0000-0000-0000-000000000001'::uuid,'A'),
('00000000-0000-0000-0000-000000000002'::uuid,'B'),
('00000000-0000-0000-0000-000000000003'::uuid,'C')),
fixture_match_reports(match_id,opponent_score) as (values (1,0),(2,1),(3,0),(4,0),(5,0),(6,0),(7,0)),
fixture_event_report_lineups(event_id,position,player_id) as (
select event_id,position,p.id from (values (1,'POR','A'),(2,'POR','A'),(1,'POR','A'),(3,'POR','B'),(4,'POR','B'),(5,'POR','C'),(6,'POR','C'),(7,'ATT','C'),(8,'POR','C')) v(event_id,position,name) join fixture_players p using(name)),
fixture_match_ratings(match_id,player_id,rating) as (
select match_id,p.id,rating from (values (1,'A',7),(1,'A',8),(2,'A',6),(3,'B',8),(4,'B',8),(5,'C',9),(7,'C',7),(8,'C',7)) v(match_id,name,rating) join fixture_players p using(name)),
fixture_archived_match_history(original_event_id,opponent_score,player_rows) as (
select event_id,score,jsonb_build_array(jsonb_build_object('player_id',p.id,'role','POR','rating',rating)) from (values (1,0,'A',7),(9,2,'A',7),(10,0,'C',null::integer)) v(event_id,score,name,rating) join fixture_players p using(name)),
result(player_id,player_name,matches_played,clean_sheets) as (with live_games as (
    select distinct l.player_id, r.match_id, r.opponent_score
    from fixture_event_report_lineups l
    join fixture_match_reports r on r.match_id = l.event_id
    where l.position = 'POR' and l.player_id is not null
      and exists (select 1 from fixture_match_ratings v
        where v.match_id = l.event_id and v.player_id = l.player_id and v.rating is not null)
  ), archived_games as (
    select distinct (j->>'player_id')::uuid as player_id,
      a.original_event_id as match_id, a.opponent_score
    from fixture_archived_match_history a
    cross join lateral jsonb_array_elements(a.player_rows::jsonb) j
    where j->>'role' = 'POR' and nullif(j->>'player_id', '') is not null
      and nullif(j->>'rating', '') is not null
      and not exists (select 1 from fixture_match_reports r where r.match_id = a.original_event_id)
  ), games as (
    select * from live_games union all select * from archived_games
  )
  select p.id, p.name::text, count(*)::bigint,
    count(*) filter (where g.opponent_score = 0)::bigint
  from games g join fixture_players p on p.id = g.player_id
  group by p.id, p.name
  order by count(*) desc, count(*) filter (where g.opponent_score = 0) desc, p.name, p.id)
select jsonb_agg(jsonb_build_array(player_name,matches_played,clean_sheets) order by matches_played desc,clean_sheets desc,player_name) as actual,
jsonb_agg(jsonb_build_array(player_name,matches_played,clean_sheets) order by matches_played desc,clean_sheets desc,player_name) = '[["A",3,1],["B",2,2],["C",1,1]]'::jsonb as passed from result;

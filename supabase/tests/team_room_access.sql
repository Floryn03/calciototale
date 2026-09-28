begin;
do $$ begin
perform set_config('test.admin',(select id::text from public.profiles where role='admin' limit 1),true);
perform set_config('test.player',(select a.user_id::text from public.player_accounts a where not exists(select 1 from public.profiles p where p.id=a.user_id and p.role='admin') limit 1),true);
perform set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
end $$;
set local role authenticated;
do $$ declare moment_id uuid; begin
insert into public.team_room_weeks(week_start,title) values('2099-01-05','Verifica') on conflict(week_start) do update set title='Verifica';
insert into public.team_room_moments(title) values('Verifica temporanea') returning id into moment_id;
perform set_config('test.moment',moment_id::text,true);
update public.team_room_moments set caption='Verifica modifica' where id=moment_id;
if not found then raise exception 'Admin update failed'; end if;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('test.player'),true); end $$;
set local role authenticated;
do $$ declare n integer; begin
if not exists(select 1 from public.team_room_weeks where week_start='2099-01-05') then raise exception 'Player week read failed'; end if;
if not exists(select 1 from public.team_room_moments where id=current_setting('test.moment')::uuid) then raise exception 'Player moment read failed'; end if;
update public.team_room_weeks set title='Forbidden' where week_start='2099-01-05';
get diagnostics n=row_count; if n<>0 then raise exception 'Player wrote settings'; end if;
update public.team_room_moments set caption='Forbidden' where id=current_setting('test.moment')::uuid;
get diagnostics n=row_count; if n<>0 then raise exception 'Player wrote moment'; end if;
begin insert into public.team_room_moments(title) values('Forbidden'); raise exception 'Player inserted moment'; exception when insufficient_privilege then null; end;
begin delete from public.team_room_moments where id=current_setting('test.moment')::uuid; raise exception 'Player delete granted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('test.admin'),true); end $$;
set local role authenticated;
update public.team_room_moments set archived=true where id=current_setting('test.moment')::uuid;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('test.player'),true); end $$;
set local role authenticated;
do $$ begin if exists(select 1 from public.team_room_moments where id=current_setting('test.moment')::uuid) then raise exception 'Archived moment leaked'; end if; end $$;
rollback;
select 'PASS: Admin create/edit/archive, player read-only, archived hidden; all test data rolled back' as result;
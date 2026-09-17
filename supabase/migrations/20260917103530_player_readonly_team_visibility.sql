-- Expand sports read access for linked players; leave all write policies unchanged.
alter policy players_select_authenticated on public.players
using (
  exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  or exists (select 1 from public.player_accounts where user_id = (select auth.uid()))
);
alter policy presences_select_authenticated on public.presences
using (
  exists (select 1 from public.profiles where id = (select auth.uid()) and role = 'admin')
  or exists (select 1 from public.player_accounts where user_id = (select auth.uid()))
);

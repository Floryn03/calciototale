drop policy if exists archived_match_history_update_admin on public.archived_match_history;
create policy archived_match_history_update_admin
on public.archived_match_history for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);
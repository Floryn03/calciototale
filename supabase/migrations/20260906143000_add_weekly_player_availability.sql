create table public.weekly_player_availability (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  availability_date date not null,
  status text not null check (status in ('Presente', 'Assente')),
  event_role text null check (
    event_role is null or event_role in ('POR', 'DCD', 'DCC', 'DCS', 'ES', 'ED', 'CCS', 'CDC', 'CCD', 'ATT')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, availability_date),
  check (
    (status = 'Presente' and event_role is not null)
    or (status = 'Assente' and event_role is null)
  )
);

create index weekly_player_availability_date_idx
  on public.weekly_player_availability(availability_date);

alter table public.weekly_player_availability enable row level security;

create policy weekly_player_availability_select_own_or_admin
  on public.weekly_player_availability
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
    or exists (
      select 1 from public.player_accounts
      where player_accounts.user_id = (select auth.uid())
        and player_accounts.player_id = weekly_player_availability.player_id
    )
  );

create policy weekly_player_availability_insert_own_or_admin
  on public.weekly_player_availability
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
    or exists (
      select 1 from public.player_accounts
      where player_accounts.user_id = (select auth.uid())
        and player_accounts.player_id = weekly_player_availability.player_id
    )
  );

create policy weekly_player_availability_update_own_or_admin
  on public.weekly_player_availability
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
    or exists (
      select 1 from public.player_accounts
      where player_accounts.user_id = (select auth.uid())
        and player_accounts.player_id = weekly_player_availability.player_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
    or exists (
      select 1 from public.player_accounts
      where player_accounts.user_id = (select auth.uid())
        and player_accounts.player_id = weekly_player_availability.player_id
    )
  );
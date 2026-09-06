-- Calendario indipendente dagli Eventi.
-- Gli utenti autenticati possono leggere; solo gli Admin possono modificare.

create table if not exists public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  title text not null check (char_length(trim(title)) between 1 and 160),
  entry_time time,
  note text check (note is null or char_length(note) <= 600),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_entries_entry_date_idx
  on public.calendar_entries (entry_date, entry_time);

alter table public.calendar_entries enable row level security;

grant select on public.calendar_entries to authenticated;
grant insert, update, delete on public.calendar_entries to authenticated;

drop policy if exists "calendar_entries_select_authenticated" on public.calendar_entries;
create policy "calendar_entries_select_authenticated"
  on public.calendar_entries for select
  to authenticated
  using (true);

drop policy if exists "calendar_entries_insert_admin" on public.calendar_entries;
create policy "calendar_entries_insert_admin"
  on public.calendar_entries for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

drop policy if exists "calendar_entries_update_admin" on public.calendar_entries;
create policy "calendar_entries_update_admin"
  on public.calendar_entries for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );

drop policy if exists "calendar_entries_delete_admin" on public.calendar_entries;
create policy "calendar_entries_delete_admin"
  on public.calendar_entries for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'admin'
    )
  );
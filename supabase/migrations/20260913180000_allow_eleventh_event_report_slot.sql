-- Seconda riga ATT nel referto partita: estende solo il numero massimo di righe.
alter table public.event_report_lineups
  drop constraint if exists event_report_lineups_slot_order_check;

alter table public.event_report_lineups
  add constraint event_report_lineups_slot_order_check
  check (slot_order between 1 and 11);

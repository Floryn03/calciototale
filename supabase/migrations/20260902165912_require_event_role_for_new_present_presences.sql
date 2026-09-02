ALTER TABLE public.presences
  DROP CONSTRAINT IF EXISTS presences_event_role_only_when_present;

ALTER TABLE public.presences
  ADD CONSTRAINT presences_event_role_only_when_present
  CHECK (
    (status = 'Presente' AND event_role IS NOT NULL)
    OR (status <> 'Presente' AND event_role IS NULL)
  ) NOT VALID;

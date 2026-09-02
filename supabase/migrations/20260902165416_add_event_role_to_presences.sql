ALTER TABLE public.presences
  ADD COLUMN IF NOT EXISTS event_role text;

ALTER TABLE public.presences
  DROP CONSTRAINT IF EXISTS presences_event_role_allowed;

ALTER TABLE public.presences
  ADD CONSTRAINT presences_event_role_allowed
  CHECK (
    event_role IS NULL
    OR event_role IN ('POR', 'DCD', 'DCC', 'DCS', 'ES', 'ED', 'CCS', 'CDC', 'CCD', 'ATT')
  );

ALTER TABLE public.presences
  DROP CONSTRAINT IF EXISTS presences_event_role_only_when_present;

ALTER TABLE public.presences
  ADD CONSTRAINT presences_event_role_only_when_present
  CHECK (status = 'Presente' OR event_role IS NULL);

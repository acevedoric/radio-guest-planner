-- Estado de la investigación con IA (n8n) por invitado.
-- Los campos de contenido por hora ya existen; aquí solo se agrega el seguimiento.
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS research_status text,
  ADD COLUMN IF NOT EXISTS research_hour text,
  ADD COLUMN IF NOT EXISTS research_error text,
  ADD COLUMN IF NOT EXISTS research_updated_at timestamptz;

ALTER TABLE public.guests
  DROP CONSTRAINT IF EXISTS guests_research_status_check;
ALTER TABLE public.guests
  ADD CONSTRAINT guests_research_status_check
  CHECK (research_status IS NULL OR research_status IN ('pending', 'done', 'error'));

ALTER TABLE public.guests
  DROP CONSTRAINT IF EXISTS guests_research_hour_check;
ALTER TABLE public.guests
  ADD CONSTRAINT guests_research_hour_check
  CHECK (research_hour IS NULL OR research_hour IN ('H1', 'H2', 'H3'));

-- No se otorgan a anon: guests_anon y los GRANT por columna no las incluyen.
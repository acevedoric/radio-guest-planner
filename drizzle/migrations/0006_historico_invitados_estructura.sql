CREATE TABLE IF NOT EXISTS public.invitados_historicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date,
  day_of_week text,
  hour_number integer,
  guest_name text NOT NULL,
  guest_name_normalized text GENERATED ALWAYS AS (lower(public.unaccent_immutable(guest_name))) STORED,
  tema text,
  year integer,
  source_file text,
  guest_id uuid REFERENCES public.guests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitados_historicos_name_trgm ON public.invitados_historicos USING GIN (guest_name_normalized gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_invitados_historicos_fecha ON public.invitados_historicos (fecha);
CREATE INDEX IF NOT EXISTS idx_invitados_historicos_guest_id ON public.invitados_historicos (guest_id);

ALTER TABLE public.invitados_historicos ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.invitados_historicos TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.invitados_historicos TO authenticated;
GRANT ALL ON public.invitados_historicos TO service_role;

DROP POLICY IF EXISTS "Authenticated can read invitados historicos" ON public.invitados_historicos;
CREATE POLICY "Authenticated can read invitados historicos"
ON public.invitados_historicos FOR SELECT TO authenticated
USING (true);

DROP POLICY IF EXISTS "Producers and admins manage invitados historicos" ON public.invitados_historicos;
CREATE POLICY "Producers and admins manage invitados historicos"
ON public.invitados_historicos FOR ALL TO authenticated
USING (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.libretos_chunks ADD COLUMN IF NOT EXISTS fecha date;
CREATE INDEX IF NOT EXISTS idx_libretos_chunks_fecha ON public.libretos_chunks (fecha);

ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS festivo boolean NOT NULL DEFAULT false;

ALTER TABLE public.guests DROP CONSTRAINT IF EXISTS guests_recording_status_check;
ALTER TABLE public.guests ADD CONSTRAINT guests_recording_status_check
  CHECK (recording_status IN ('live', 'recorded', 'to_record', 'postponed', 'proposed', 'cancelled'));
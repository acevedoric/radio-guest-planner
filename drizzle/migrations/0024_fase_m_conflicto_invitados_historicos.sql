ALTER TABLE public.invitados_historicos
  ADD COLUMN IF NOT EXISTS conflicto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conflicto_nota text;
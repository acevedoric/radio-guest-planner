ALTER TABLE public.invitados_historicos
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS grabado_con_anticipacion boolean NOT NULL DEFAULT false;
ALTER TABLE public.libretos_chunks
  ADD COLUMN IF NOT EXISTS conflicto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conflicto_nota text;
CREATE INDEX IF NOT EXISTS idx_libretos_chunks_conflicto
  ON public.libretos_chunks (conflicto) WHERE conflicto;
ALTER TABLE public.invitados_historicos
  ADD COLUMN IF NOT EXISTS prensa_raw text;
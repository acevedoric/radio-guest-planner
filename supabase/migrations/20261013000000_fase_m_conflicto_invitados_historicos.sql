-- FASE M: agrega conflicto/conflicto_nota a invitados_historicos (mismo
-- patrón que libretos_chunks, que ya las tiene) para dejar de incrustar la
-- nota de conflicto sin resolver dentro de `tema`. La migración de los
-- datos YA cargados (mover la nota de tema a conflicto_nota) va en un
-- UPDATE aparte -- ver bbb-ingest/migrate_conflicto_notes.sql -- porque
-- afecta filas existentes, no el esquema.

ALTER TABLE public.invitados_historicos
  ADD COLUMN IF NOT EXISTS conflicto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conflicto_nota text;

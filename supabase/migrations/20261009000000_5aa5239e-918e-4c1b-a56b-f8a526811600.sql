-- FASE C (histórico BBB): soporte para conflictos de GUÍA sin resolver y
-- texto de prensa/contacto cortado del nombre en CALENDARIO.
--
-- conflicto / conflicto_nota (libretos_chunks): cuando el documento fuente
-- tiene revisiones sin limpiar para la misma (fecha, hora) con invitados
-- distintos y ninguna fuente externa (CALENDARIO/PROMOS) permite decidir
-- cuál es la vigente, se cargan TODAS las versiones en disputa marcadas
-- conflicto=true con una nota, en vez de adivinar o excluir.
--
-- prensa_raw (invitados_historicos): texto de prensa/contacto que el
-- parser corta del nombre del invitado (ver lib/normalize.js,
-- cutPrensaFromName) cuando la celda no usa una etiqueta "Invitado:" clara
-- y el nombre queda pegado a "Prensa:"/"Contacto:"/"Tel"/"Cel"/un teléfono.
-- Se conserva solo para auditoría; no se expone en ningún flujo de la app.

ALTER TABLE public.libretos_chunks
  ADD COLUMN IF NOT EXISTS conflicto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conflicto_nota text;

CREATE INDEX IF NOT EXISTS idx_libretos_chunks_conflicto
  ON public.libretos_chunks (conflicto) WHERE conflicto;

ALTER TABLE public.invitados_historicos
  ADD COLUMN IF NOT EXISTS prensa_raw text;

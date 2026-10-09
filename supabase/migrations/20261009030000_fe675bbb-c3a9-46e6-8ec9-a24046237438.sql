-- invitados_historicos: columna para el descriptor separado del nombre
-- (cargo/ocupación/agrupación, p.ej. "actor" en "Miguel González, actor") y
-- la fusión grabación+emisión (misma aparición real registrada una sola
-- vez, marcada cuando el contenido se grabó con anticipación).
--
-- No hay columna "festivo": en BBB el festivo no cambia la parrilla (hay
-- programa de lunes a jueves igual) — lo único relevante es que el
-- programa de un día festivo se graba la semana anterior. Por eso toda
-- fila cuya fecha es festivo (festivos_co.js) entra con
-- grabado_con_anticipacion=true directamente, sin necesitar su propia
-- columna.

ALTER TABLE public.invitados_historicos
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS grabado_con_anticipacion boolean NOT NULL DEFAULT false;

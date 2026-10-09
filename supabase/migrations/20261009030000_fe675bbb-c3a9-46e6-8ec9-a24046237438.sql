-- invitados_historicos: columnas para el descriptor separado del nombre
-- (cargo/ocupación/agrupación, p.ej. "actor" en "Miguel González, actor"),
-- el festivo colombiano (Ley Emiliani, calculado en bbb-ingest/lib/festivos_co.js)
-- y la fusión grabación+emisión (misma aparición real registrada una sola
-- vez, marcada cuando el contenido se grabó con anticipación).

ALTER TABLE public.invitados_historicos
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS festivo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS grabado_con_anticipacion boolean NOT NULL DEFAULT false;

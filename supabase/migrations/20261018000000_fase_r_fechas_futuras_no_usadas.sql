-- FASE R: buscar_cancion mezclaba emisiones pasadas y futuras en un solo
-- "ultima_vez" (una canción asignada a un programa de 2026-10-14 aún no
-- emitido aparecía como "sonó" ese día). Se separa en ultima_emision
-- (fecha <= hoy) y proxima_programada (fecha > hoy). También: nueva RPC
-- canciones_no_usadas para "qué salsas no han sonado este año".

-- Cambia el tipo de retorno (ultima_vez -> ultima_emision + proxima_programada).
DROP FUNCTION IF EXISTS public.buscar_cancion(text, text);

CREATE OR REPLACE FUNCTION public.buscar_cancion(p_texto text, p_catalogo text DEFAULT NULL)
RETURNS TABLE (
  cancion_id uuid,
  titulo text,
  artista text,
  catalogo text,
  genero text,
  es_cortinilla boolean,
  veces_usada integer,
  ultima_emision date,
  proxima_programada date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
#variable_conflict use_column
DECLARE
  is_allowed boolean := public.has_role(auth.uid(), 'producer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role);
  q_norm text := lower(public.unaccent_immutable(coalesce(p_texto, '')));
BEGIN
  IF NOT is_allowed THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id AS cancion_id, c.titulo, c.artista, c.catalogo, c.genero, c.es_cortinilla,
    (SELECT count(*)::integer FROM public.canciones_uso cu WHERE cu.cancion_id = c.id) AS veces_usada,
    (SELECT max(cu.fecha) FROM public.canciones_uso cu WHERE cu.cancion_id = c.id AND cu.fecha <= current_date) AS ultima_emision,
    (SELECT min(cu.fecha) FROM public.canciones_uso cu WHERE cu.cancion_id = c.id AND cu.fecha > current_date) AS proxima_programada
  FROM public.canciones c
  WHERE (p_catalogo IS NULL OR c.catalogo = p_catalogo)
    AND (
      q_norm = ''
      OR c.titulo_normalizado LIKE '%' || q_norm || '%'
      OR lower(public.unaccent_immutable(coalesce(c.artista, ''))) LIKE '%' || q_norm || '%'
      OR similarity(c.titulo_normalizado, q_norm) > 0.3
    )
  ORDER BY
    CASE WHEN c.titulo_normalizado = q_norm THEN 0 ELSE 1 END,
    similarity(c.titulo_normalizado, q_norm) DESC
  LIMIT 50;
END;
$function$;

REVOKE ALL ON FUNCTION public.buscar_cancion(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_cancion(text, text) TO authenticated;

-- canciones_no_usadas: canciones del catálogo/género que NO tienen uso
-- en [p_desde, p_hasta]. periodo_sin_historial avisa cuando ese periodo
-- no tiene NINGÚN registro de uso (p.ej. años antes de que existiera la
-- tabla canciones_uso), para que chat-guests lo diga explícito en vez de
-- sugerir que "no sonó ninguna".
CREATE OR REPLACE FUNCTION public.canciones_no_usadas(
  p_genero text DEFAULT NULL,
  p_catalogo text DEFAULT NULL,
  p_desde date DEFAULT NULL,
  p_hasta date DEFAULT NULL,
  p_limite integer DEFAULT 30
)
RETURNS TABLE (
  cancion_id uuid,
  titulo text,
  artista text,
  catalogo text,
  genero text,
  ultima_emision date,
  periodo_sin_historial boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
#variable_conflict use_column
DECLARE
  is_allowed boolean := public.has_role(auth.uid(), 'producer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role);
  total_en_periodo integer;
BEGIN
  IF NOT is_allowed THEN
    RETURN;
  END IF;

  SELECT count(*) INTO total_en_periodo
  FROM public.canciones_uso cu
  WHERE cu.fecha IS NOT NULL
    AND (p_desde IS NULL OR cu.fecha >= p_desde)
    AND (p_hasta IS NULL OR cu.fecha <= p_hasta);

  RETURN QUERY
  SELECT
    c.id AS cancion_id, c.titulo, c.artista, c.catalogo, c.genero,
    (SELECT max(cu2.fecha) FROM public.canciones_uso cu2 WHERE cu2.cancion_id = c.id AND cu2.fecha <= current_date) AS ultima_emision,
    (total_en_periodo = 0) AS periodo_sin_historial
  FROM public.canciones c
  WHERE c.es_cortinilla = false
    AND (p_genero IS NULL OR c.genero = p_genero)
    AND (p_catalogo IS NULL OR c.catalogo = p_catalogo)
    AND NOT EXISTS (
      SELECT 1 FROM public.canciones_uso cu3
      WHERE cu3.cancion_id = c.id
        AND cu3.fecha IS NOT NULL
        AND (p_desde IS NULL OR cu3.fecha >= p_desde)
        AND (p_hasta IS NULL OR cu3.fecha <= p_hasta)
    )
  ORDER BY c.titulo
  LIMIT p_limite;
END;
$function$;

REVOKE ALL ON FUNCTION public.canciones_no_usadas(text, text, date, date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.canciones_no_usadas(text, text, date, date, integer) TO authenticated;

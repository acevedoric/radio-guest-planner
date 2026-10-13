-- FASE T: confirmar canciones al aire. canciones_uso.estado
-- (programada/emitida/no_emitida). Las filas 'no_emitida' no cuentan
-- como sonadas en buscar_cancion, canciones_no_usadas ni sugerir_canciones.
ALTER TABLE public.canciones_uso ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'programada';
ALTER TABLE public.canciones_uso ADD CONSTRAINT canciones_uso_estado_check CHECK (estado IN ('programada','emitida','no_emitida'));
UPDATE public.canciones_uso SET estado = 'emitida' WHERE fecha < current_date;
GRANT UPDATE (estado) ON public.canciones_uso TO authenticated;
DROP POLICY IF EXISTS "Producers and admins update canciones uso estado" ON public.canciones_uso;
CREATE POLICY "Producers and admins update canciones uso estado" ON public.canciones_uso FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'producer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'producer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.sugerir_canciones(
  p_fecha date,
  p_day_of_week text,
  p_hour_number integer,
  p_genero text DEFAULT NULL,
  p_limite integer DEFAULT 10
)
RETURNS TABLE (
  cancion_id uuid,
  titulo text,
  artista text,
  catalogo text,
  genero text,
  es_firma boolean,
  veces_usada integer,
  ultima_vez date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
#variable_conflict use_column
DECLARE
  is_allowed boolean := public.has_role(auth.uid(), 'producer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role);
  no_repeat_weeks integer;
  cutoff date;
BEGIN
  IF NOT is_allowed THEN
    RETURN;
  END IF;

  SELECT coalesce(valor::integer, 8) INTO no_repeat_weeks FROM public.ajustes WHERE clave = 'no_repeat_weeks';
  no_repeat_weeks := coalesce(no_repeat_weeks, 8);
  cutoff := p_fecha - (no_repeat_weeks * 7);

  RETURN QUERY
  SELECT
    c.id AS cancion_id, c.titulo, c.artista, c.catalogo, c.genero,
    true AS es_firma,
    (SELECT count(*)::integer FROM public.canciones_uso cu WHERE cu.estado <> 'no_emitida' AND cu.cancion_id = c.id) AS veces_usada,
    (SELECT max(cu.fecha) FROM public.canciones_uso cu WHERE cu.estado <> 'no_emitida' AND cu.cancion_id = c.id) AS ultima_vez
  FROM public.cancion_segmento cs
  JOIN public.canciones c ON c.id = cs.cancion_id
  WHERE cs.day_of_week = p_day_of_week AND cs.hour_number = p_hour_number AND cs.es_firma = true;

  RETURN QUERY
  SELECT
    c.id AS cancion_id, c.titulo, c.artista, c.catalogo, c.genero,
    false AS es_firma,
    (SELECT count(*)::integer FROM public.canciones_uso cu WHERE cu.estado <> 'no_emitida' AND cu.cancion_id = c.id) AS veces_usada,
    (SELECT max(cu.fecha) FROM public.canciones_uso cu WHERE cu.estado <> 'no_emitida' AND cu.cancion_id = c.id) AS ultima_vez
  FROM public.canciones c
  WHERE c.es_cortinilla = false
    AND (p_genero IS NULL OR c.genero = p_genero)
    AND NOT EXISTS (
      SELECT 1 FROM public.cancion_segmento cs2
      WHERE cs2.cancion_id = c.id AND cs2.day_of_week = p_day_of_week AND cs2.hour_number = p_hour_number AND cs2.es_firma = true
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.canciones_uso cu2
      WHERE cu2.estado <> 'no_emitida' AND cu2.cancion_id = c.id AND cu2.fecha IS NOT NULL AND cu2.fecha >= cutoff AND cu2.fecha < p_fecha
    )
  ORDER BY random()
  LIMIT p_limite;
END;
$function$;

REVOKE ALL ON FUNCTION public.sugerir_canciones(date, text, integer, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sugerir_canciones(date, text, integer, text, integer) TO authenticated;

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
    (SELECT count(*)::integer FROM public.canciones_uso cu WHERE cu.estado <> 'no_emitida' AND cu.cancion_id = c.id) AS veces_usada,
    (SELECT max(cu.fecha) FROM public.canciones_uso cu WHERE cu.estado <> 'no_emitida' AND cu.cancion_id = c.id AND cu.fecha <= current_date) AS ultima_emision,
    (SELECT min(cu.fecha) FROM public.canciones_uso cu WHERE cu.estado <> 'no_emitida' AND cu.cancion_id = c.id AND cu.fecha > current_date) AS proxima_programada
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
  WHERE cu.estado <> 'no_emitida' AND cu.fecha IS NOT NULL
    AND (p_desde IS NULL OR cu.fecha >= p_desde)
    AND (p_hasta IS NULL OR cu.fecha <= p_hasta);

  RETURN QUERY
  SELECT
    c.id AS cancion_id, c.titulo, c.artista, c.catalogo, c.genero,
    (SELECT max(cu2.fecha) FROM public.canciones_uso cu2 WHERE cu2.estado <> 'no_emitida' AND cu2.cancion_id = c.id AND cu2.fecha <= current_date) AS ultima_emision,
    (total_en_periodo = 0) AS periodo_sin_historial
  FROM public.canciones c
  WHERE c.es_cortinilla = false
    AND (p_genero IS NULL OR c.genero = p_genero)
    AND (p_catalogo IS NULL OR c.catalogo = p_catalogo)
    AND NOT EXISTS (
      SELECT 1 FROM public.canciones_uso cu3
      WHERE cu3.estado <> 'no_emitida' AND cu3.cancion_id = c.id
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

-- cambiar_cancion_uso: "Cambiar por…" -- la original queda 'no_emitida'
-- y la que realmente sonó se registra 'emitida' en la misma fecha/hora.
CREATE OR REPLACE FUNCTION public.cambiar_cancion_uso(p_uso_id uuid, p_titulo text, p_artista text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
#variable_conflict use_column
DECLARE
  orig public.canciones_uso%ROWTYPE;
  nueva uuid;
  nuevo_uso uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'producer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_titulo IS NULL OR btrim(p_titulo) = '' THEN
    RAISE EXCEPTION 'Título requerido';
  END IF;
  SELECT * INTO orig FROM public.canciones_uso WHERE id = p_uso_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Uso de canción no encontrado';
  END IF;
  UPDATE public.canciones_uso SET estado = 'no_emitida' WHERE id = p_uso_id;
  nueva := public.upsert_cancion(btrim(p_titulo), nullif(btrim(coalesce(p_artista, '')), ''), NULL, 'otros', false);
  INSERT INTO public.canciones_uso (cancion_id, fecha, day_of_week, hour_number, segmento, guest_id, source_file, estado)
  VALUES (nueva, orig.fecha, orig.day_of_week, orig.hour_number, orig.segmento, orig.guest_id, 'cambio_al_aire', 'emitida')
  RETURNING id INTO nuevo_uso;
  RETURN nuevo_uso;
END;
$function$;

REVOKE ALL ON FUNCTION public.cambiar_cancion_uso(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cambiar_cancion_uso(uuid, text, text) TO authenticated;

ALTER TABLE public.canciones ADD COLUMN IF NOT EXISTS genero text NOT NULL DEFAULT 'otro';
ALTER TABLE public.canciones DROP CONSTRAINT IF EXISTS canciones_genero_check;
ALTER TABLE public.canciones ADD CONSTRAINT canciones_genero_check
  CHECK (genero IN ('anglo', 'español', 'tropical', 'salsa', 'otro'));

DROP FUNCTION IF EXISTS public.upsert_cancion(text, text, integer, text, boolean);

CREATE OR REPLACE FUNCTION public.upsert_cancion(
  p_titulo text, p_artista text DEFAULT NULL, p_anio integer DEFAULT NULL,
  p_catalogo text DEFAULT 'otros', p_es_cortinilla boolean DEFAULT false,
  p_genero text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  result_id uuid;
BEGIN
  SELECT c.id INTO result_id FROM public.canciones c
    WHERE c.titulo_normalizado = lower(public.unaccent_immutable(p_titulo))
      AND coalesce(lower(public.unaccent_immutable(c.artista)), '') = coalesce(lower(public.unaccent_immutable(p_artista)), '')
    LIMIT 1;

  IF result_id IS NULL THEN
    INSERT INTO public.canciones (titulo, artista, anio, catalogo, es_cortinilla, genero)
    VALUES (p_titulo, p_artista, p_anio, coalesce(p_catalogo, 'otros'), coalesce(p_es_cortinilla, false), coalesce(p_genero, 'otro'))
    ON CONFLICT (titulo_normalizado, coalesce(lower(public.unaccent_immutable(artista)), '')) DO NOTHING
    RETURNING id INTO result_id;
  END IF;

  IF result_id IS NULL THEN
    SELECT c.id INTO result_id FROM public.canciones c
      WHERE c.titulo_normalizado = lower(public.unaccent_immutable(p_titulo))
        AND coalesce(lower(public.unaccent_immutable(c.artista)), '') = coalesce(lower(public.unaccent_immutable(p_artista)), '')
      LIMIT 1;
  END IF;

  IF result_id IS NOT NULL AND p_genero IS NOT NULL AND p_genero <> 'otro' THEN
    UPDATE public.canciones SET genero = p_genero WHERE id = result_id AND genero = 'otro';
  END IF;

  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_cancion(text, text, integer, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_cancion(text, text, integer, text, boolean, text) TO authenticated, service_role;

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
    (SELECT count(*)::integer FROM public.canciones_uso cu WHERE cu.cancion_id = c.id) AS veces_usada,
    (SELECT max(cu.fecha) FROM public.canciones_uso cu WHERE cu.cancion_id = c.id) AS ultima_vez
  FROM public.cancion_segmento cs
  JOIN public.canciones c ON c.id = cs.cancion_id
  WHERE cs.day_of_week = p_day_of_week AND cs.hour_number = p_hour_number AND cs.es_firma = true;

  RETURN QUERY
  SELECT
    c.id AS cancion_id, c.titulo, c.artista, c.catalogo, c.genero,
    false AS es_firma,
    (SELECT count(*)::integer FROM public.canciones_uso cu WHERE cu.cancion_id = c.id) AS veces_usada,
    (SELECT max(cu.fecha) FROM public.canciones_uso cu WHERE cu.cancion_id = c.id) AS ultima_vez
  FROM public.canciones c
  WHERE c.es_cortinilla = false
    AND (p_genero IS NULL OR c.genero = p_genero)
    AND NOT EXISTS (
      SELECT 1 FROM public.cancion_segmento cs2
      WHERE cs2.cancion_id = c.id AND cs2.day_of_week = p_day_of_week AND cs2.hour_number = p_hour_number AND cs2.es_firma = true
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.canciones_uso cu2
      WHERE cu2.cancion_id = c.id AND cu2.fecha IS NOT NULL AND cu2.fecha >= cutoff AND cu2.fecha < p_fecha
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
  q_norm text := lower(public.unaccent_immutable(coalesce(p_texto, '')));
BEGIN
  IF NOT is_allowed THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id AS cancion_id, c.titulo, c.artista, c.catalogo, c.genero, c.es_cortinilla,
    (SELECT count(*)::integer FROM public.canciones_uso cu WHERE cu.cancion_id = c.id) AS veces_usada,
    (SELECT max(cu.fecha) FROM public.canciones_uso cu WHERE cu.cancion_id = c.id) AS ultima_vez
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
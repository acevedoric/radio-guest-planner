-- FASE L:
-- 1) El respaldo AND suelto de libretos_chunks ahora solo corre si la
--    búsqueda por nombre/frase no dio NINGÚN resultado en ninguna fuente
--    (guests, histórico, libreto por frase) -- antes corría siempre que
--    la frase no matcheaba ESE chunk en particular, lo que generaba
--    "menciones" falsas (Daniela Sarria, etc. para "Miguel Gonzalez",
--    cuando la frase solo vive en su propio bloque). Un resultado del
--    respaldo nunca se etiqueta tipo='mencion' (esa etiqueta exige la
--    frase literal en el libreto de otro invitado).
-- 2) guests.name e invitados_historicos.guest_name: alcanza con que estén
--    TODAS las palabras de la búsqueda (sin acentos, en cualquier orden)
--    -- ya no se exige que sean una subcadena contigua. La frase adyacente
--    solo se exige en el contenido de libretos_chunks.
-- 3) Los chunks de libreto de la MISMA fecha real + hora que una aparición
--    ya devuelta (guest o histórico) ya no salen como filas sueltas: esa
--    aparición trae tiene_libreto=true y libreto_chunk_ids (array) en su
--    lugar. Una fila de libreto suelta solo aparece si no hay guest ni
--    histórico para esa fecha+hora.
--
-- #variable_conflict use_column se conserva.

DROP FUNCTION IF EXISTS public.buscar_invitados_rank(text, integer);

CREATE OR REPLACE FUNCTION public.buscar_invitados_rank(query_text text, max_results integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  name text,
  guest_position text,
  topic text,
  recording_status text,
  day_of_week text,
  time_slot integer,
  week_date date,
  scheduled_date date,
  tier integer,
  rank real,
  source text,
  snippet text,
  guest_id uuid,
  tiene_historico boolean,
  tipo text,
  tiene_libreto boolean,
  libreto_chunk_ids uuid[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
#variable_conflict use_column
DECLARE
  q_clean text := regexp_replace(query_text, E'[«»“”‘’"''¿?¡!.,;:()\\[\\]{}]', ' ', 'g');
  q_norm text;
  q_tsq tsquery;
  q_tsq_plain tsquery;
  q_words text[];
  q_phrase text;
  is_authed boolean := public.has_role(auth.uid(), 'producer'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role);
  found integer;
  primary_has_rows boolean;
BEGIN
  q_clean := trim(regexp_replace(q_clean, '\s+', ' ', 'g'));
  q_norm := lower(public.unaccent_immutable(q_clean));
  q_tsq := websearch_to_tsquery('spanish', public.unaccent_immutable(q_clean));
  q_tsq_plain := websearch_to_tsquery('spanish', q_clean);
  q_words := (SELECT array_agg(w) FROM unnest(regexp_split_to_array(trim(q_norm), '\s+')) AS w WHERE w <> '');
  q_phrase := array_to_string(q_words, ' ');

  -- ¿La búsqueda por nombre/contenido (sin el respaldo AND suelto de
  -- libretos_chunks) encuentra algo en CUALQUIER fuente? Si no, se habilita
  -- el respaldo más abajo. Duplica (en forma de EXISTS, sin construir
  -- filas) las mismas condiciones de tiered/historico_match/libreto-frase.
  SELECT (
    EXISTS (
      SELECT 1 FROM public.guests g
      WHERE lower(public.unaccent_immutable(g.name)) = q_norm
         OR lower(public.unaccent_immutable(g.name)) LIKE q_norm || '%'
         OR lower(public.unaccent_immutable(g.name)) LIKE '%' || q_norm || '%'
         OR (q_words IS NOT NULL AND array_length(q_words, 1) IS NOT NULL AND
             (SELECT bool_and(position(w IN lower(public.unaccent_immutable(g.name))) > 0) FROM unnest(q_words) AS w))
         OR to_tsvector('spanish', public.unaccent_immutable(coalesce(g.position, '') || ' ' || coalesce(g.topic, ''))) @@ q_tsq
         OR (is_authed AND to_tsvector('spanish', public.unaccent_immutable(
               coalesce(g.tema_principal, '') || ' ' || coalesce(g.infancia_vida_privada, '') || ' ' ||
               coalesce(g.carrera_profesional, '') || ' ' || coalesce(g.datos_curiosos, '') || ' ' ||
               coalesce(g.h2_info_personal, '') || ' ' || coalesce(g.h2_preguntas_sugeridas, '') || ' ' ||
               coalesce(g.h3_datos_personales, '') || ' ' || coalesce(g.h3_comunicado_prensa, '')
             )) @@ q_tsq)
    )
    OR (is_authed AND EXISTS (
      SELECT 1 FROM public.invitados_historicos ih
      WHERE ih.guest_name_normalized = q_norm
         OR ih.guest_name_normalized LIKE '%' || q_norm || '%'
         OR (q_words IS NOT NULL AND array_length(q_words, 1) IS NOT NULL AND
             (SELECT bool_and(position(w IN lower(public.unaccent_immutable(ih.guest_name))) > 0) FROM unnest(q_words) AS w))
         OR to_tsvector('spanish', public.unaccent_immutable(coalesce(ih.cargo, '') || ' ' || coalesce(ih.tema, ''))) @@ q_tsq
    ))
    OR (is_authed AND EXISTS (
      SELECT 1 FROM public.libretos_chunks lc
      WHERE lc.fts @@ q_tsq_plain
        AND (
          q_words IS NULL OR array_length(q_words, 1) IS NULL OR array_length(q_words, 1) < 2
          OR regexp_replace(lower(public.unaccent_immutable(lc.content)), '\s+', ' ', 'g') LIKE '%' || q_phrase || '%'
        )
    ))
  ) INTO primary_has_rows;

  RETURN QUERY
  WITH real_date_guests AS (
    SELECT
      g.id, g.name, g.position, g.topic, g.recording_status, g.time_slot, g.week_date,
      COALESCE(g.scheduled_date, g.week_date + CASE g.day_of_week
        WHEN 'monday' THEN 0 WHEN 'tuesday' THEN 1 WHEN 'wednesday' THEN 2 WHEN 'thursday' THEN 3 END) AS fecha_real,
      g.tema_principal, g.infancia_vida_privada, g.carrera_profesional, g.datos_curiosos,
      g.h2_info_personal, g.h2_preguntas_sugeridas, g.h3_datos_personales, g.h3_comunicado_prensa
    FROM public.guests g
  ),
  tiered AS (
    SELECT
      rdg.id, rdg.name, rdg.position AS guest_position, rdg.topic, rdg.recording_status,
      CASE extract(dow FROM rdg.fecha_real)
        WHEN 0 THEN 'domingo' WHEN 1 THEN 'lunes' WHEN 2 THEN 'martes' WHEN 3 THEN 'miércoles'
        WHEN 4 THEN 'jueves' WHEN 5 THEN 'viernes' WHEN 6 THEN 'sábado'
      END AS day_of_week,
      rdg.time_slot, rdg.week_date, rdg.fecha_real AS scheduled_date,
      MIN(t.tier_val) AS tier,
      NULL::uuid AS guest_id,
      EXISTS (
        SELECT 1 FROM public.invitados_historicos ih2
        WHERE ih2.guest_id = rdg.id
           OR (lower(trim(public.unaccent_immutable(ih2.guest_name))) = lower(trim(public.unaccent_immutable(rdg.name)))
               AND ih2.fecha = rdg.fecha_real AND ih2.hour_number = rdg.time_slot)
      ) AS tiene_historico,
      NULL::text AS tipo,
      EXISTS (SELECT 1 FROM public.libretos_chunks lc3 WHERE lc3.fecha = rdg.fecha_real AND lc3.hour_number = rdg.time_slot) AS tiene_libreto,
      (SELECT array_agg(lc3.id ORDER BY lc3.chunk_index) FROM public.libretos_chunks lc3 WHERE lc3.fecha = rdg.fecha_real AND lc3.hour_number = rdg.time_slot) AS libreto_chunk_ids
    FROM real_date_guests rdg
    CROSS JOIN LATERAL (
      VALUES
        (CASE WHEN lower(public.unaccent_immutable(rdg.name)) = q_norm THEN 1 END),
        (CASE WHEN lower(public.unaccent_immutable(rdg.name)) LIKE q_norm || '%' THEN 2 END),
        (CASE WHEN lower(public.unaccent_immutable(rdg.name)) LIKE '%' || q_norm || '%'
              OR (q_words IS NOT NULL AND array_length(q_words, 1) IS NOT NULL AND
                  (SELECT bool_and(position(w IN lower(public.unaccent_immutable(rdg.name))) > 0) FROM unnest(q_words) AS w))
              THEN 3 END),
        (CASE WHEN to_tsvector('spanish', public.unaccent_immutable(
            coalesce(rdg.position, '') || ' ' || coalesce(rdg.topic, '')
          )) @@ q_tsq THEN 4 END),
        (CASE WHEN is_authed AND to_tsvector('spanish', public.unaccent_immutable(
            coalesce(rdg.tema_principal, '') || ' ' || coalesce(rdg.infancia_vida_privada, '') || ' ' ||
            coalesce(rdg.carrera_profesional, '') || ' ' || coalesce(rdg.datos_curiosos, '') || ' ' ||
            coalesce(rdg.h2_info_personal, '') || ' ' || coalesce(rdg.h2_preguntas_sugeridas, '') || ' ' ||
            coalesce(rdg.h3_datos_personales, '') || ' ' || coalesce(rdg.h3_comunicado_prensa, '')
          )) @@ q_tsq THEN 5 END)
    ) AS t(tier_val)
    WHERE t.tier_val IS NOT NULL
    GROUP BY rdg.id, rdg.name, rdg.position, rdg.topic, rdg.recording_status,
             rdg.fecha_real, rdg.time_slot, rdg.week_date
  ),
  historico_match AS (
    SELECT
      ih.id, ih.guest_name AS name, ih.tema AS topic, ih.hour_number, ih.fecha, ih.guest_id,
      ih.guest_name_normalized,
      (
        q_words IS NULL OR array_length(q_words, 1) IS NULL OR
        (SELECT bool_and(position(w IN lower(public.unaccent_immutable(ih.guest_name))) > 0) FROM unnest(q_words) AS w)
      ) AS name_matched,
      CASE WHEN ih.guest_name_normalized = q_norm THEN 6 ELSE 7 END AS tier
    FROM public.invitados_historicos ih
    WHERE is_authed AND (
      ih.guest_name_normalized = q_norm
      OR ih.guest_name_normalized LIKE '%' || q_norm || '%'
      OR (q_words IS NOT NULL AND array_length(q_words, 1) IS NOT NULL AND
          (SELECT bool_and(position(w IN lower(public.unaccent_immutable(ih.guest_name))) > 0) FROM unnest(q_words) AS w))
      OR to_tsvector('spanish', public.unaccent_immutable(coalesce(ih.cargo, '') || ' ' || coalesce(ih.tema, ''))) @@ q_tsq
    )
  ),
  historico_resolved AS (
    SELECT DISTINCT hm.id AS historico_id, rdg.id AS resolved_guest_id
    FROM historico_match hm
    JOIN real_date_guests rdg ON (
      rdg.id = hm.guest_id
      OR (lower(trim(public.unaccent_immutable(rdg.name))) = hm.guest_name_normalized
          AND rdg.fecha_real = hm.fecha AND rdg.time_slot = hm.hour_number)
    )
    WHERE hm.name_matched
  ),
  historico_unresolved AS (
    SELECT hm.* FROM historico_match hm
    WHERE NOT EXISTS (SELECT 1 FROM historico_resolved hr WHERE hr.historico_id = hm.id)
  ),
  historico AS (
    SELECT
      hu.id, hu.name, NULL::text AS guest_position, hu.topic,
      NULL::text AS recording_status,
      CASE extract(dow FROM hu.fecha)
        WHEN 0 THEN 'domingo' WHEN 1 THEN 'lunes' WHEN 2 THEN 'martes' WHEN 3 THEN 'miércoles'
        WHEN 4 THEN 'jueves' WHEN 5 THEN 'viernes' WHEN 6 THEN 'sábado'
      END AS day_of_week,
      hu.hour_number AS time_slot,
      NULL::date AS week_date, hu.fecha AS scheduled_date,
      hu.tier,
      hu.guest_id,
      false AS tiene_historico,
      NULL::text AS tipo,
      EXISTS (SELECT 1 FROM public.libretos_chunks lc3 WHERE lc3.fecha = hu.fecha AND lc3.hour_number = hu.hour_number) AS tiene_libreto,
      (SELECT array_agg(lc3.id ORDER BY lc3.chunk_index) FROM public.libretos_chunks lc3 WHERE lc3.fecha = hu.fecha AND lc3.hour_number = hu.hour_number) AS libreto_chunk_ids
    FROM historico_unresolved hu
  ),
  linked_app AS (
    SELECT DISTINCT
      rdg.id, rdg.name, rdg.position AS guest_position, rdg.topic, rdg.recording_status,
      CASE extract(dow FROM rdg.fecha_real)
        WHEN 0 THEN 'domingo' WHEN 1 THEN 'lunes' WHEN 2 THEN 'martes' WHEN 3 THEN 'miércoles'
        WHEN 4 THEN 'jueves' WHEN 5 THEN 'viernes' WHEN 6 THEN 'sábado'
      END AS day_of_week,
      rdg.time_slot, rdg.week_date, rdg.fecha_real AS scheduled_date,
      6 AS tier,
      NULL::uuid AS guest_id,
      true AS tiene_historico,
      NULL::text AS tipo,
      EXISTS (SELECT 1 FROM public.libretos_chunks lc3 WHERE lc3.fecha = rdg.fecha_real AND lc3.hour_number = rdg.time_slot) AS tiene_libreto,
      (SELECT array_agg(lc3.id ORDER BY lc3.chunk_index) FROM public.libretos_chunks lc3 WHERE lc3.fecha = rdg.fecha_real AND lc3.hour_number = rdg.time_slot) AS libreto_chunk_ids
    FROM historico_resolved hr
    JOIN real_date_guests rdg ON rdg.id = hr.resolved_guest_id
  ),
  -- (fecha, hora) de toda aparición de guest/histórico ya cubierta arriba
  -- -- un chunk de libreto en ese mismo slot ya no sale como fila suelta
  -- (sale como tiene_libreto=true en esa aparición).
  resolved_slots AS (
    SELECT scheduled_date AS fecha, time_slot AS hora FROM tiered
    UNION
    SELECT scheduled_date, time_slot FROM linked_app
    UNION
    SELECT fecha, hour_number AS hora FROM historico_unresolved
  ),
  libreto AS (
    SELECT
      lc.id, lc.guest_name AS name, NULL::text AS guest_position, lc.source_file AS topic,
      NULL::text AS recording_status,
      CASE extract(dow FROM lc.fecha)
        WHEN 0 THEN 'domingo' WHEN 1 THEN 'lunes' WHEN 2 THEN 'martes' WHEN 3 THEN 'miércoles'
        WHEN 4 THEN 'jueves' WHEN 5 THEN 'viernes' WHEN 6 THEN 'sábado'
      END AS day_of_week,
      lc.hour_number AS time_slot,
      NULL::date AS week_date, lc.fecha AS scheduled_date,
      CASE
        WHEN (q_words IS NULL OR array_length(q_words, 1) IS NULL OR
              (SELECT bool_and(position(w IN lower(public.unaccent_immutable(lc.guest_name))) > 0) FROM unnest(q_words) AS w))
          THEN 8   -- propio
        WHEN (q_words IS NULL OR array_length(q_words, 1) IS NULL OR array_length(q_words, 1) < 2
              OR regexp_replace(lower(public.unaccent_immutable(lc.content)), '\s+', ' ', 'g') LIKE '%' || q_phrase || '%')
          THEN 11  -- mención real (frase literal en el libreto de otro)
        ELSE 13    -- respaldo AND suelto (solo si primary_has_rows = false), sin etiqueta de mención
      END AS tier,
      substring(lc.content FROM 1 FOR 200) AS snippet,
      NULL::uuid AS guest_id,
      NULL::boolean AS tiene_historico,
      CASE
        WHEN (q_words IS NULL OR array_length(q_words, 1) IS NULL OR
              (SELECT bool_and(position(w IN lower(public.unaccent_immutable(lc.guest_name))) > 0) FROM unnest(q_words) AS w))
          THEN 'propio'
        WHEN (q_words IS NULL OR array_length(q_words, 1) IS NULL OR array_length(q_words, 1) < 2
              OR regexp_replace(lower(public.unaccent_immutable(lc.content)), '\s+', ' ', 'g') LIKE '%' || q_phrase || '%')
          THEN 'mencion'
        ELSE NULL
      END AS tipo,
      NULL::boolean AS tiene_libreto,
      NULL::uuid[] AS libreto_chunk_ids
    FROM public.libretos_chunks lc
    WHERE is_authed
      AND lc.fts @@ q_tsq_plain
      AND NOT EXISTS (SELECT 1 FROM resolved_slots rs WHERE rs.fecha = lc.fecha AND rs.hora = lc.hour_number)
      AND (
        -- frase adyacente (o consulta de 1 palabra, donde "frase" = la palabra)
        q_words IS NULL OR array_length(q_words, 1) IS NULL OR array_length(q_words, 1) < 2
        OR regexp_replace(lower(public.unaccent_immutable(lc.content)), '\s+', ' ', 'g') LIKE '%' || q_phrase || '%'
        -- respaldo AND suelto: SOLO si ninguna fuente dio resultado por nombre/frase
        OR (NOT primary_has_rows AND (SELECT bool_and(position(w IN lower(public.unaccent_immutable(lc.content))) > 0) FROM unnest(q_words) AS w))
      )
  ),
  combined AS (
    SELECT id, name, guest_position, topic, recording_status, day_of_week, time_slot,
           week_date, scheduled_date, tier, 0::real AS rank, 'app'::text AS source, NULL::text AS snippet,
           guest_id, tiene_historico, tipo, tiene_libreto, libreto_chunk_ids
    FROM tiered
    UNION ALL
    SELECT id, name, guest_position, topic, recording_status, day_of_week, time_slot,
           week_date, scheduled_date, tier, 0::real AS rank, 'app'::text AS source, NULL::text AS snippet,
           guest_id, tiene_historico, tipo, tiene_libreto, libreto_chunk_ids
    FROM linked_app
    UNION ALL
    SELECT id, name, guest_position, topic, recording_status, day_of_week, time_slot,
           week_date, scheduled_date, tier, 0::real AS rank, 'historico'::text AS source, NULL::text AS snippet,
           guest_id, tiene_historico, tipo, tiene_libreto, libreto_chunk_ids
    FROM historico
    UNION ALL
    SELECT id, name, guest_position, topic, recording_status, day_of_week, time_slot,
           week_date, scheduled_date, tier, 0::real AS rank, 'libreto'::text AS source, snippet,
           guest_id, tiene_historico, tipo, tiene_libreto, libreto_chunk_ids
    FROM libreto
  ),
  deduped AS (
    SELECT DISTINCT ON (source, id)
      id, name, guest_position, topic, recording_status, day_of_week, time_slot,
      week_date, scheduled_date, tier, rank, source, snippet, guest_id, tiene_historico, tipo,
      tiene_libreto, libreto_chunk_ids
    FROM combined
    ORDER BY source, id, tier ASC
  )
  SELECT d.id, d.name, d.guest_position, d.topic, d.recording_status, d.day_of_week, d.time_slot,
         d.week_date, d.scheduled_date, d.tier, d.rank, d.source, d.snippet, d.guest_id, d.tiene_historico, d.tipo,
         d.tiene_libreto, d.libreto_chunk_ids
  FROM deduped d
  ORDER BY d.tier ASC, d.name ASC
  LIMIT max_results;

  GET DIAGNOSTICS found = ROW_COUNT;
  IF found > 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    g.id, g.name, g.position AS guest_position, g.topic, g.recording_status,
    CASE extract(dow FROM COALESCE(g.scheduled_date, g.week_date + CASE g.day_of_week
           WHEN 'monday' THEN 0 WHEN 'tuesday' THEN 1 WHEN 'wednesday' THEN 2 WHEN 'thursday' THEN 3 END))
      WHEN 0 THEN 'domingo' WHEN 1 THEN 'lunes' WHEN 2 THEN 'martes' WHEN 3 THEN 'miércoles'
      WHEN 4 THEN 'jueves' WHEN 5 THEN 'viernes' WHEN 6 THEN 'sábado'
    END AS day_of_week,
    g.time_slot, g.week_date,
    COALESCE(g.scheduled_date, g.week_date + CASE g.day_of_week
      WHEN 'monday' THEN 0 WHEN 'tuesday' THEN 1 WHEN 'wednesday' THEN 2 WHEN 'thursday' THEN 3 END) AS scheduled_date,
    9 AS tier,
    similarity(lower(public.unaccent_immutable(g.name)), q_norm) AS rank,
    'app'::text AS source, NULL::text AS snippet, NULL::uuid AS guest_id,
    EXISTS (
      SELECT 1 FROM public.invitados_historicos ih2
      WHERE ih2.guest_id = g.id
         OR (lower(trim(public.unaccent_immutable(ih2.guest_name))) = lower(trim(public.unaccent_immutable(g.name)))
             AND ih2.fecha = COALESCE(g.scheduled_date, g.week_date + CASE g.day_of_week
                   WHEN 'monday' THEN 0 WHEN 'tuesday' THEN 1 WHEN 'wednesday' THEN 2 WHEN 'thursday' THEN 3 END)
             AND ih2.hour_number = g.time_slot)
    ) AS tiene_historico,
    NULL::text AS tipo,
    NULL::boolean AS tiene_libreto,
    NULL::uuid[] AS libreto_chunk_ids
  FROM public.guests g
  WHERE similarity(lower(public.unaccent_immutable(g.name)), q_norm) >= 0.6
    AND (
      q_words IS NULL OR array_length(q_words, 1) IS NULL OR
      (SELECT bool_and(position(w IN lower(public.unaccent_immutable(g.name))) > 0) FROM unnest(q_words) AS w)
    )
  ORDER BY rank DESC
  LIMIT max_results;
END;
$function$;

REVOKE ALL ON FUNCTION public.buscar_invitados_rank(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buscar_invitados_rank(text, integer) TO anon, authenticated;

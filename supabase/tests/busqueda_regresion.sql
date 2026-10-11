-- Batería de regresión del buscador (FASE J/K/L + carga 2024, casos 10-13). No modifica datos ni
-- crea usuarios/roles: corre dentro de una transacción que termina en
-- ROLLBACK. Toma el uid de un producer REAL vía current_setting
-- ('test.producer_uid') -- ver supabase/tests/README.md para las 2 líneas
-- para correrla.
--
-- Resultados en una tabla temporal (test_results): se imprimen al final
-- con SELECT, legible de un vistazo en vez de tener que leer NOTICEs.

BEGIN;

CREATE TEMP TABLE test_results (
  n integer,
  descripcion text,
  status text,
  detalle text
) ON COMMIT DROP;

DO $$
DECLARE producer_uid uuid;
BEGIN
  producer_uid := current_setting('test.producer_uid', true)::uuid;
  IF producer_uid IS NULL THEN
    RAISE EXCEPTION 'Falta SELECT set_config(''test.producer_uid'', ''<uuid>'', false) antes de correr este archivo';
  END IF;
  IF NOT (public.has_role(producer_uid, 'producer'::app_role) OR public.has_role(producer_uid, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'test.producer_uid % no tiene rol producer ni admin -- pasa el uuid de una cuenta real con ese rol', producer_uid;
  END IF;
  -- Solo fija el JWT para que auth.uid()/has_role() reconozcan a este
  -- producer dentro de la transacción -- no cambia de rol de Postgres.
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', producer_uid::text, 'role', 'authenticated')::text,
    true
  );
END $$;

-- Compara nombres normalizados (sin acentos, sin mayúsculas, sin espacios de borde).
CREATE OR REPLACE FUNCTION pg_temp.norm_eq(a text, b text) RETURNS boolean AS $$
  SELECT lower(trim(public.unaccent_immutable(coalesce(a, '')))) = lower(trim(public.unaccent_immutable(coalesce(b, ''))));
$$ LANGUAGE sql;

-- 1. ranking_invitados 2025 -> Germán Puerta = 47 en primer lugar
DO $$
DECLARE r record;
BEGIN
  SELECT nombre, apariciones INTO r FROM public.ranking_invitados('2025-01-01', '2025-12-31', 1) LIMIT 1;
  IF pg_temp.norm_eq(r.nombre, 'Germán Puerta') AND r.apariciones = 47 THEN
    INSERT INTO test_results VALUES (1, 'ranking_invitados 2025 top1 = Germán Puerta (47)', 'PASS', NULL);
  ELSE
    INSERT INTO test_results VALUES (1, 'ranking_invitados 2025 top1 = Germán Puerta (47)', 'FAIL', format('obtuvo %s (%s)', r.nombre, r.apariciones));
  END IF;
END $$;

-- 2. Maira Pérez y Paola Pérez como dos personas distintas, 10 apariciones cada una
DO $$
DECLARE maira integer; paola integer;
BEGIN
  SELECT apariciones INTO maira FROM public.ranking_invitados('2025-01-01', '2025-12-31', 200) r WHERE pg_temp.norm_eq(r.nombre, 'Maira Pérez');
  SELECT apariciones INTO paola FROM public.ranking_invitados('2025-01-01', '2025-12-31', 200) r WHERE pg_temp.norm_eq(r.nombre, 'Paola Pérez');
  IF maira = 10 AND paola = 10 THEN
    INSERT INTO test_results VALUES (2, 'Maira Pérez y Paola Pérez distintas, 10 c/u', 'PASS', NULL);
  ELSE
    INSERT INTO test_results VALUES (2, 'Maira Pérez y Paola Pérez distintas, 10 c/u', 'FAIL', format('Maira=%s Paola=%s', maira, paola));
  END IF;
END $$;

-- 3. apariciones_invitado('German Puerta', 2025) -> 47 filas
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.apariciones_invitado('German Puerta', '2025-01-01', '2025-12-31');
  IF n = 47 THEN
    INSERT INTO test_results VALUES (3, 'apariciones_invitado(German Puerta, 2025) = 47', 'PASS', NULL);
  ELSE
    INSERT INTO test_results VALUES (3, 'apariciones_invitado(German Puerta, 2025) = 47', 'FAIL', format('obtuvo %s', n));
  END IF;
END $$;

-- 4. contar_invitados('chef', 2025) -> comparación EXACTA de los 6 nombres
DO $$
DECLARE total_n integer; nombres text[]; esperados text[] := ARRAY[
  'Alex Correa', 'Andrés Fernández León', 'Jorge Rausch', 'Juan Carlos Orrego',
  'Sergio y Pablo Mejía (The Kitchen Brothers)', 'Tulio Zuloaga'
];
BEGIN
  SELECT total, (SELECT array_agg(x->>'nombre' ORDER BY x->>'nombre') FROM jsonb_array_elements(apariciones) x)
    INTO total_n, nombres
  FROM public.contar_invitados('chef', '2025-01-01', '2025-12-31');
  IF total_n = 6 AND nombres = (SELECT array_agg(e ORDER BY e) FROM unnest(esperados) e) THEN
    INSERT INTO test_results VALUES (4, 'contar_invitados(chef, 2025) = 6 nombres exactos', 'PASS', NULL);
  ELSE
    INSERT INTO test_results VALUES (4, 'contar_invitados(chef, 2025) = 6 nombres exactos', 'FAIL', format('total=%s nombres=%s', total_n, nombres));
  END IF;
END $$;

-- 5. invitados_por_fecha('2025-02-13', 1) -> Luisa Vergara
DO $$
DECLARE n integer; nombre_val text;
BEGIN
  SELECT count(*), (array_agg(nombre))[1] INTO n, nombre_val
  FROM public.invitados_por_fecha('2025-02-13', 1);
  IF n = 1 AND pg_temp.norm_eq(nombre_val, 'Luisa Vergara') THEN
    INSERT INTO test_results VALUES (5, 'invitados_por_fecha(2025-02-13, hora 1) = Luisa Vergara', 'PASS', NULL);
  ELSE
    INSERT INTO test_results VALUES (5, 'invitados_por_fecha(2025-02-13, hora 1) = Luisa Vergara', 'FAIL', format('%s filas, nombre=%s', n, nombre_val));
  END IF;
END $$;

-- 6. buscar_invitados_rank('Miguel Gonzalez') -> la aparición del
--    13/08/2025 UNA SOLA VEZ, con tiene_historico=true y tiene_libreto=true;
--    0 filas tipo='mencion'.
DO $$
DECLARE n_13ago integer; hist_13ago boolean; libreto_13ago boolean; n_mencion integer;
BEGIN
  SELECT count(*), (array_agg(tiene_historico))[1], (array_agg(tiene_libreto))[1]
    INTO n_13ago, hist_13ago, libreto_13ago
  FROM public.buscar_invitados_rank('Miguel Gonzalez', 20)
  WHERE scheduled_date = '2025-08-13';

  SELECT count(*) INTO n_mencion
  FROM public.buscar_invitados_rank('Miguel Gonzalez', 20)
  WHERE tipo = 'mencion';

  IF n_13ago = 1 AND hist_13ago = true AND libreto_13ago = true AND n_mencion = 0 THEN
    INSERT INTO test_results VALUES (6, 'buscar_invitados_rank(Miguel Gonzalez): 2025-08-13 x1, tiene_historico+tiene_libreto, 0 menciones', 'PASS', NULL);
  ELSE
    INSERT INTO test_results VALUES (6, 'buscar_invitados_rank(Miguel Gonzalez): 2025-08-13 x1, tiene_historico+tiene_libreto, 0 menciones', 'FAIL',
      format('13ago(n=%s,hist=%s,libreto=%s) menciones=%s', n_13ago, hist_13ago, libreto_13ago, n_mencion));
  END IF;
END $$;

-- 7. buscar_invitados_rank('Ezequiel peralta') -> Ezequiel López 13/03/2025
--    con tiene_historico=true y tiene_libreto=true, nunca Miguel González
DO $$
DECLARE n integer; has_miguel boolean; fecha_val date; hist boolean; libreto boolean;
BEGIN
  SELECT
    count(*) FILTER (WHERE scheduled_date = '2025-03-13'),
    bool_or(pg_temp.norm_eq(name, 'Miguel González')),
    (array_agg(scheduled_date) FILTER (WHERE scheduled_date = '2025-03-13'))[1],
    (array_agg(tiene_historico) FILTER (WHERE scheduled_date = '2025-03-13'))[1],
    (array_agg(tiene_libreto) FILTER (WHERE scheduled_date = '2025-03-13'))[1]
  INTO n, has_miguel, fecha_val, hist, libreto
  FROM public.buscar_invitados_rank('Ezequiel peralta', 20);

  IF n = 1 AND NOT has_miguel AND fecha_val = '2025-03-13' AND hist = true AND libreto = true THEN
    INSERT INTO test_results VALUES (7, '"Ezequiel peralta" -> Ezequiel López 2025-03-13, tiene_historico+tiene_libreto, sin Miguel González', 'PASS', NULL);
  ELSE
    INSERT INTO test_results VALUES (7, '"Ezequiel peralta" -> Ezequiel López 2025-03-13, tiene_historico+tiene_libreto, sin Miguel González', 'FAIL',
      format('n=%s miguel=%s fecha=%s hist=%s libreto=%s', n, has_miguel, fecha_val, hist, libreto));
  END IF;
END $$;

-- 7b. buscar_invitados_rank('ezequiel lopez') -> la aparición del
--    13/03/2025 UNA SOLA VEZ con tiene_historico=true; otras fechas válidas.
DO $$
DECLARE n_13mar integer; hist_13mar boolean;
BEGIN
  SELECT count(*), (array_agg(tiene_historico))[1] INTO n_13mar, hist_13mar
  FROM public.buscar_invitados_rank('ezequiel lopez', 20)
  WHERE scheduled_date = '2025-03-13';

  IF n_13mar = 1 AND hist_13mar = true THEN
    INSERT INTO test_results VALUES (8, '"ezequiel lopez" -> 2025-03-13 una sola vez con tiene_historico', 'PASS', NULL);
  ELSE
    INSERT INTO test_results VALUES (8, '"ezequiel lopez" -> 2025-03-13 una sola vez con tiene_historico', 'FAIL', format('13mar(n=%s,hist=%s)', n_13mar, hist_13mar));
  END IF;
END $$;

-- 9. buscar_invitados_rank('«Miguel González»') -> igual que sin comillas
DO $$
DECLARE con_comillas jsonb; sin_comillas jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('id', id, 'source', source, 'scheduled_date', scheduled_date, 'tipo', tipo) ORDER BY id, source)
    INTO con_comillas
  FROM public.buscar_invitados_rank('«Miguel González»', 20);

  SELECT jsonb_agg(jsonb_build_object('id', id, 'source', source, 'scheduled_date', scheduled_date, 'tipo', tipo) ORDER BY id, source)
    INTO sin_comillas
  FROM public.buscar_invitados_rank('Miguel González', 20);

  IF con_comillas = sin_comillas AND con_comillas IS NOT NULL THEN
    INSERT INTO test_results VALUES (9, 'buscar_invitados_rank con comillas « » = mismo resultado que sin comillas', 'PASS', NULL);
  ELSE
    INSERT INTO test_results VALUES (9, 'buscar_invitados_rank con comillas « » = mismo resultado que sin comillas', 'FAIL', format('con=%s sin=%s', con_comillas, sin_comillas));
  END IF;
END $$;

-- 10. ranking_invitados 2024 -> Germán Puerta = 41 en primer lugar
DO $$
DECLARE r record;
BEGIN
  SELECT nombre, apariciones INTO r FROM public.ranking_invitados('2024-01-01', '2024-12-31', 1) LIMIT 1;
  IF pg_temp.norm_eq(r.nombre, 'Germán Puerta') AND r.apariciones = 41 THEN
    INSERT INTO test_results VALUES (10, 'ranking_invitados 2024 top1 = Germán Puerta (41)', 'PASS', NULL);
  ELSE
    INSERT INTO test_results VALUES (10, 'ranking_invitados 2024 top1 = Germán Puerta (41)', 'FAIL', format('obtuvo %s (%s)', r.nombre, r.apariciones));
  END IF;
END $$;

-- 11. apariciones_invitado('Carlos Guillermo Fajardo', 2024) -> 10 filas,
--     todas la misma persona (unificación "...Fajardo" -> "...Fajardo Segura")
DO $$
DECLARE n integer; distintos integer;
BEGIN
  SELECT count(*), count(DISTINCT lower(trim(public.unaccent_immutable(nombre))))
    INTO n, distintos
  FROM public.apariciones_invitado('Carlos Guillermo Fajardo', '2024-01-01', '2024-12-31');
  IF n = 10 AND distintos = 1 THEN
    INSERT INTO test_results VALUES (11, 'apariciones_invitado(Carlos Guillermo Fajardo, 2024) = 10, una sola persona', 'PASS', NULL);
  ELSE
    INSERT INTO test_results VALUES (11, 'apariciones_invitado(Carlos Guillermo Fajardo, 2024) = 10, una sola persona', 'FAIL', format('n=%s distintos=%s', n, distintos));
  END IF;
END $$;

-- 12. invitados_por_fecha('2024-08-22', 1) -> Luisa Vergara (FASE N: la
--     nota de bluradio.com del 22 de agosto de 2024 confirma a Luisa
--     Vergara -- Yanet Waldman quedó estado_emision='planeado_no_emitido'
--     y ya no debe salir en esta consulta).
DO $$
DECLARE n integer; nombre_val text;
BEGIN
  SELECT count(*), (array_agg(nombre))[1] INTO n, nombre_val
  FROM public.invitados_por_fecha('2024-08-22', 1);
  IF n = 1 AND pg_temp.norm_eq(nombre_val, 'Luisa Vergara') THEN
    INSERT INTO test_results VALUES (12, 'invitados_por_fecha(2024-08-22, hora 1) = Luisa Vergara (FASE N)', 'PASS', NULL);
  ELSE
    INSERT INTO test_results VALUES (12, 'invitados_por_fecha(2024-08-22, hora 1) = Luisa Vergara (FASE N)', 'FAIL', format('%s filas, nombre=%s', n, nombre_val));
  END IF;
END $$;

-- 13. invitados_por_fecha('2024-10-15', 1) -> Fabio Rubiano
DO $$
DECLARE n integer; nombre_val text;
BEGIN
  SELECT count(*), (array_agg(nombre))[1] INTO n, nombre_val
  FROM public.invitados_por_fecha('2024-10-15', 1);
  IF n = 1 AND pg_temp.norm_eq(nombre_val, 'Fabio Rubiano') THEN
    INSERT INTO test_results VALUES (13, 'invitados_por_fecha(2024-10-15, hora 1) = Fabio Rubiano', 'PASS', NULL);
  ELSE
    INSERT INTO test_results VALUES (13, 'invitados_por_fecha(2024-10-15, hora 1) = Fabio Rubiano', 'FAIL', format('%s filas, nombre=%s', n, nombre_val));
  END IF;
END $$;

-- 14. ranking_invitados NO debe contar filas estado_emision=
--     'planeado_no_emitido' (FASE N) -- marca una fila de prueba temporal
--     con ese estado y confirma que apariciones_invitado ya no la trae.
--     Usa un nombre que no existe en datos reales para no interferir con
--     ninguna otra prueba, e inserta/borra dentro de la misma transacción
--     (ROLLBACK al final, no deja rastro).
DO $$
DECLARE n_antes integer; n_despues integer;
BEGIN
  INSERT INTO public.invitados_historicos (fecha, day_of_week, hour_number, guest_name, year, source_file, estado_emision)
  VALUES ('2024-06-03', 'monday', 1, 'Prueba Fase N No Emitido', 2024, 'test_fase_n.docx', 'planeado_no_emitido');

  SELECT count(*) INTO n_antes
  FROM public.apariciones_invitado('Prueba Fase N No Emitido', '2024-01-01', '2024-12-31');

  UPDATE public.invitados_historicos SET estado_emision = 'emitido'
  WHERE guest_name = 'Prueba Fase N No Emitido' AND fecha = '2024-06-03';

  SELECT count(*) INTO n_despues
  FROM public.apariciones_invitado('Prueba Fase N No Emitido', '2024-01-01', '2024-12-31');

  DELETE FROM public.invitados_historicos WHERE guest_name = 'Prueba Fase N No Emitido';

  IF n_antes = 0 AND n_despues = 1 THEN
    INSERT INTO test_results VALUES (14, 'apariciones_invitado/ranking_invitados ignoran planeado_no_emitido (FASE N)', 'PASS', NULL);
  ELSE
    INSERT INTO test_results VALUES (14, 'apariciones_invitado/ranking_invitados ignoran planeado_no_emitido (FASE N)', 'FAIL', format('antes=%s despues=%s (esperado 0 y 1)', n_antes, n_despues));
  END IF;
END $$;

-- 15. buscar_invitados_rank('Yanet Waldman') -> trae la fila del
--     2024-08-22 con estado_emision='planeado_no_emitido' (la búsqueda NO
--     filtra por estado -- eso lo pinta la UI). Requiere que el backfill
--     de la validación web ya haya corrido sobre esa fila.
DO $$
DECLARE estado_val text; n integer;
BEGIN
  SELECT count(*), (array_agg(estado_emision))[1] INTO n, estado_val
  FROM public.buscar_invitados_rank('Yanet Waldman', 20)
  WHERE scheduled_date = '2024-08-22';
  IF n >= 1 AND estado_val = 'planeado_no_emitido' THEN
    INSERT INTO test_results VALUES (15, 'buscar_invitados_rank(Yanet Waldman): 2024-08-22 con estado_emision=planeado_no_emitido', 'PASS', NULL);
  ELSE
    INSERT INTO test_results VALUES (15, 'buscar_invitados_rank(Yanet Waldman): 2024-08-22 con estado_emision=planeado_no_emitido', 'FAIL', format('n=%s estado=%s (revisa si ya corrió el backfill de validate_2024_2025)', n, estado_val));
  END IF;
END $$;

-- 16. Llenado de vacíos (FASE N): una fila de prueba sin cargo/tema se
--     llena con prioridad web > promo > GUÍA y nunca sobrescribe un dato
--     ya presente. Todo dentro de la transacción (ROLLBACK, no deja rastro).
DO $$
DECLARE cargo_despues text; tema_original text := 'Tema original GUÍA, no debe borrarse';
BEGIN
  INSERT INTO public.invitados_historicos (fecha, day_of_week, hour_number, guest_name, cargo, tema, year, source_file)
  VALUES ('2024-06-04', 'tuesday', 1, 'Prueba Fase N Llenado', NULL, tema_original, 2024, 'test_fase_n.docx');

  UPDATE public.invitados_historicos
  SET cargo = 'cargo de prueba (simula llenado desde web)', campos_fuente = '{"cargo":"web"}'::jsonb
  WHERE guest_name = 'Prueba Fase N Llenado' AND cargo IS NULL;

  SELECT cargo, tema INTO cargo_despues, tema_original
  FROM public.invitados_historicos WHERE guest_name = 'Prueba Fase N Llenado';

  DELETE FROM public.invitados_historicos WHERE guest_name = 'Prueba Fase N Llenado';

  IF cargo_despues = 'cargo de prueba (simula llenado desde web)' AND tema_original = 'Tema original GUÍA, no debe borrarse' THEN
    INSERT INTO test_results VALUES (16, 'Llenado de vacíos: cargo se llena, tema existente no se sobrescribe', 'PASS', NULL);
  ELSE
    INSERT INTO test_results VALUES (16, 'Llenado de vacíos: cargo se llena, tema existente no se sobrescribe', 'FAIL', format('cargo=%s tema=%s', cargo_despues, tema_original));
  END IF;
END $$;

SELECT n, status, descripcion, detalle FROM test_results ORDER BY n;

ROLLBACK;

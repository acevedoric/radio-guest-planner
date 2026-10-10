-- Batería de regresión del buscador (FASE J/K/L). No modifica datos ni
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

SELECT n, status, descripcion, detalle FROM test_results ORDER BY n;

ROLLBACK;

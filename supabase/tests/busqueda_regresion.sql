-- Batería de regresión del buscador (FASE I). No modifica datos: corre
-- dentro de una transacción que termina en ROLLBACK, así que puede
-- ejecutarse en cualquier momento sin efectos permanentes. Simula una
-- sesión producer insertando un rol temporal para un uuid de prueba y
-- fijando request.jwt.claims -- esa inserción también se revierte en el
-- ROLLBACK final.
--
-- Uso: psql "$DATABASE_URL" -f supabase/tests/busqueda_regresion.sql
-- Cada caso imprime PASS o FAIL con el detalle. Revisa la salida: no hay
-- un resumen automático de "todo ok", hay que leer cada línea.

BEGIN;

DO $$
DECLARE
  test_uid uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (test_uid, 'producer'::app_role)
  ON CONFLICT DO NOTHING;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', test_uid::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
END $$;

-- 1. ranking_invitados 2025 -> Germán Puerta = 47 en primer lugar
DO $$
DECLARE r record;
BEGIN
  SELECT nombre, apariciones INTO r FROM public.ranking_invitados('2025-01-01', '2025-12-31', 1) LIMIT 1;
  IF r.nombre = 'Germán Puerta' AND r.apariciones = 47 THEN
    RAISE NOTICE 'PASS 1: ranking_invitados 2025 top1 = Germán Puerta (47)';
  ELSE
    RAISE NOTICE 'FAIL 1: ranking_invitados 2025 top1 = % (%), esperado Germán Puerta (47)', r.nombre, r.apariciones;
  END IF;
END $$;

-- 2. Maira Pérez y Paola Pérez como dos personas distintas, 10 apariciones cada una
DO $$
DECLARE maira integer; paola integer;
BEGIN
  SELECT apariciones INTO maira FROM public.ranking_invitados('2025-01-01', '2025-12-31', 200) WHERE nombre = 'Maira Pérez';
  SELECT apariciones INTO paola FROM public.ranking_invitados('2025-01-01', '2025-12-31', 200) WHERE nombre = 'Paola Pérez';
  IF maira = 10 AND paola = 10 THEN
    RAISE NOTICE 'PASS 2: Maira Pérez y Paola Pérez son personas distintas, 10 apariciones cada una';
  ELSE
    RAISE NOTICE 'FAIL 2: Maira Pérez=% Paola Pérez=% (esperado 10 y 10)', maira, paola;
  END IF;
END $$;

-- 3. apariciones_invitado('German Puerta', 2025) -> 47 filas
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.apariciones_invitado('German Puerta', '2025-01-01', '2025-12-31');
  IF n = 47 THEN
    RAISE NOTICE 'PASS 3: apariciones_invitado(German Puerta, 2025) = 47';
  ELSE
    RAISE NOTICE 'FAIL 3: apariciones_invitado(German Puerta, 2025) = % (esperado 47)', n;
  END IF;
END $$;

-- 4. contar_invitados('chef', 2025) -> exactamente estas 6 personas
DO $$
DECLARE total_n integer; nombres text[]; esperados text[] := ARRAY[
  'Alex Correa', 'Andrés Fernández León', 'Jorge Rausch', 'Juan Carlos Orrego',
  'Sergio y Pablo Mejía (The Kitchen Brothers)', 'Tulio Zuloaga'
];
BEGIN
  SELECT total, (SELECT array_agg(x->>'nombre' ORDER BY x->>'nombre') FROM jsonb_array_elements(apariciones) x)
    INTO total_n, nombres
  FROM public.contar_invitados('chef', '2025-01-01', '2025-12-31');
  IF total_n = 6
     AND nombres = (SELECT array_agg(e ORDER BY e) FROM unnest(esperados) e)
     AND NOT ('Germán Puerta' = ANY(nombres))
     AND NOT ('Logan Parra' = ANY(nombres))
     AND NOT ('Daniel Villa Camacho' = ANY(nombres))
     AND NOT ('Angélica Martínez' = ANY(nombres))
  THEN
    RAISE NOTICE 'PASS 4: contar_invitados(chef, 2025) = 6 personas exactas, sin falsos positivos';
  ELSE
    RAISE NOTICE 'FAIL 4: contar_invitados(chef, 2025) total=% nombres=%', total_n, nombres;
  END IF;
END $$;

-- 5. invitados_por_fecha('2025-02-13', 1) -> Luisa Vergara
DO $$
DECLARE n integer; nombre_val text;
BEGIN
  SELECT count(*), (array_agg(nombre))[1] INTO n, nombre_val
  FROM public.invitados_por_fecha('2025-02-13', 1);
  IF n = 1 AND nombre_val = 'Luisa Vergara' THEN
    RAISE NOTICE 'PASS 5: invitados_por_fecha(2025-02-13, hora 1) = Luisa Vergara';
  ELSE
    RAISE NOTICE 'FAIL 5: invitados_por_fecha(2025-02-13, hora 1) = % filas, nombre=% (esperado 1, Luisa Vergara)', n, nombre_val;
  END IF;
END $$;

-- 6. buscar_invitados_rank('Miguel Gonzalez') -> una sola fila, del 13/08/2025
DO $$
DECLARE n integer; fecha_val date;
BEGIN
  SELECT count(*), (array_agg(scheduled_date))[1] INTO n, fecha_val
  FROM public.buscar_invitados_rank('Miguel Gonzalez', 20);
  IF n = 1 AND fecha_val = '2025-08-13' THEN
    RAISE NOTICE 'PASS 6: buscar_invitados_rank(Miguel Gonzalez) = 1 fila, 2025-08-13';
  ELSE
    RAISE NOTICE 'FAIL 6: buscar_invitados_rank(Miguel Gonzalez) = % filas, fecha=% (esperado 1, 2025-08-13)', n, fecha_val;
  END IF;
END $$;

-- 7. buscar_invitados_rank('Ezequiel peralta') y ('ezequiel lopez') -> Ezequiel López 13/03/2025, nunca Miguel González
DO $$
DECLARE n1 integer; has_miguel1 boolean; n2 integer; has_miguel2 boolean; fecha1 date; fecha2 date;
BEGIN
  SELECT count(*), bool_or(name = 'Miguel González'), (array_agg(scheduled_date) FILTER (WHERE name ILIKE '%ezequiel%'))[1]
    INTO n1, has_miguel1, fecha1
  FROM public.buscar_invitados_rank('Ezequiel peralta', 20);

  SELECT count(*), bool_or(name = 'Miguel González'), (array_agg(scheduled_date) FILTER (WHERE name ILIKE '%ezequiel%'))[1]
    INTO n2, has_miguel2, fecha2
  FROM public.buscar_invitados_rank('ezequiel lopez', 20);

  IF NOT has_miguel1 AND fecha1 = '2025-03-13' AND NOT has_miguel2 AND fecha2 = '2025-03-13' THEN
    RAISE NOTICE 'PASS 7: "Ezequiel peralta" y "ezequiel lopez" -> Ezequiel López 2025-03-13, sin Miguel González';
  ELSE
    RAISE NOTICE 'FAIL 7: peralta(n=%,miguel=%,fecha=%) lopez(n=%,miguel=%,fecha=%)', n1, has_miguel1, fecha1, n2, has_miguel2, fecha2;
  END IF;
END $$;

-- 8. buscar_invitados_rank('«Miguel González»') -> igual que sin comillas
DO $$
DECLARE con_comillas jsonb; sin_comillas jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('id', id, 'source', source, 'scheduled_date', scheduled_date) ORDER BY id, source)
    INTO con_comillas
  FROM public.buscar_invitados_rank('«Miguel González»', 20);

  SELECT jsonb_agg(jsonb_build_object('id', id, 'source', source, 'scheduled_date', scheduled_date) ORDER BY id, source)
    INTO sin_comillas
  FROM public.buscar_invitados_rank('Miguel González', 20);

  IF con_comillas = sin_comillas AND con_comillas IS NOT NULL THEN
    RAISE NOTICE 'PASS 8: buscar_invitados_rank con comillas « » da el mismo resultado que sin comillas';
  ELSE
    RAISE NOTICE 'FAIL 8: con comillas=% sin comillas=%', con_comillas, sin_comillas;
  END IF;
END $$;

ROLLBACK;

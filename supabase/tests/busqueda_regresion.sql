-- Batería de regresión del buscador (FASE J/K). No modifica datos ni crea
-- usuarios/roles: corre dentro de una transacción que termina en ROLLBACK,
-- y usa el user_id de un producer REAL que ya exista (pasado como
-- variable), solo para que has_role(auth.uid(), ...) lo reconozca durante
-- la transacción -- no se inserta ni cambia ningún rol.
--
-- Uso:
--   psql "$DATABASE_URL" -v producer_uid="'<uuid-de-un-producer-real>'" \
--     -f supabase/tests/busqueda_regresion.sql
--
-- Cada caso imprime PASS o FAIL con el detalle. Revisa la salida: no hay
-- un resumen automático de "todo ok", hay que leer cada línea.

\if :{?producer_uid}
\else
  \echo 'ERROR: falta -v producer_uid="''<uuid>''"  (uuid de un producer/admin real)'
  \quit
\endif

BEGIN;

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', :producer_uid::text, 'role', 'authenticated')::text,
  true
);
SELECT set_config('role', 'authenticated', true);

-- Confirma que el uuid pasado de verdad tiene rol producer/admin -- si no,
-- todo lo demás va a fallar por una razón ajena a los bugs que se prueban.
DO $$
BEGIN
  IF NOT (public.has_role(:producer_uid::uuid, 'producer'::app_role) OR public.has_role(:producer_uid::uuid, 'admin'::app_role)) THEN
    RAISE EXCEPTION 'producer_uid % no tiene rol producer ni admin -- pasa el uuid de una cuenta real con ese rol', :producer_uid;
  END IF;
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
    RAISE NOTICE 'PASS 1: ranking_invitados 2025 top1 = Germán Puerta (47)';
  ELSE
    RAISE NOTICE 'FAIL 1: ranking_invitados 2025 top1 = % (%), esperado Germán Puerta (47)', r.nombre, r.apariciones;
  END IF;
END $$;

-- 2. Maira Pérez y Paola Pérez como dos personas distintas, 10 apariciones cada una
DO $$
DECLARE maira integer; paola integer;
BEGIN
  SELECT apariciones INTO maira FROM public.ranking_invitados('2025-01-01', '2025-12-31', 200) r WHERE pg_temp.norm_eq(r.nombre, 'Maira Pérez');
  SELECT apariciones INTO paola FROM public.ranking_invitados('2025-01-01', '2025-12-31', 200) r WHERE pg_temp.norm_eq(r.nombre, 'Paola Pérez');
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
     AND NOT EXISTS (SELECT 1 FROM unnest(nombres) n WHERE pg_temp.norm_eq(n, 'Germán Puerta'))
     AND NOT EXISTS (SELECT 1 FROM unnest(nombres) n WHERE pg_temp.norm_eq(n, 'Logan Parra'))
     AND NOT EXISTS (SELECT 1 FROM unnest(nombres) n WHERE pg_temp.norm_eq(n, 'Daniel Villa Camacho'))
     AND NOT EXISTS (SELECT 1 FROM unnest(nombres) n WHERE pg_temp.norm_eq(n, 'Angélica Martínez'))
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
  IF n = 1 AND pg_temp.norm_eq(nombre_val, 'Luisa Vergara') THEN
    RAISE NOTICE 'PASS 5: invitados_por_fecha(2025-02-13, hora 1) = Luisa Vergara';
  ELSE
    RAISE NOTICE 'FAIL 5: invitados_por_fecha(2025-02-13, hora 1) = % filas, nombre=% (esperado 1, Luisa Vergara)', n, nombre_val;
  END IF;
END $$;

-- 6. buscar_invitados_rank('Miguel Gonzalez') -> una sola fila PROPIA
--    (13/08/2025, tiene_historico=true); cualquier otra fila debe ser
--    tipo='mencion' (fragmento de libreto de otra persona que lo nombra).
DO $$
DECLARE n_propio integer; fecha_val date; tiene_hist boolean; n_mencion_no_propio integer;
BEGIN
  SELECT count(*), (array_agg(scheduled_date))[1], (array_agg(tiene_historico))[1]
    INTO n_propio, fecha_val, tiene_hist
  FROM public.buscar_invitados_rank('Miguel Gonzalez', 20)
  WHERE source != 'libreto' OR tipo = 'propio';

  SELECT count(*) INTO n_mencion_no_propio
  FROM public.buscar_invitados_rank('Miguel Gonzalez', 20)
  WHERE source = 'libreto' AND tipo != 'mencion';

  IF n_propio = 1 AND fecha_val = '2025-08-13' AND tiene_hist = true AND n_mencion_no_propio = 0 THEN
    RAISE NOTICE 'PASS 6: buscar_invitados_rank(Miguel Gonzalez) = 1 fila propia (2025-08-13, tiene_historico), resto solo menciones';
  ELSE
    RAISE NOTICE 'FAIL 6: propio=% fecha=% tiene_historico=% libreto_no_mencion=%', n_propio, fecha_val, tiene_hist, n_mencion_no_propio;
  END IF;
END $$;

-- 7. buscar_invitados_rank('Ezequiel peralta') y ('ezequiel lopez') ->
--    Ezequiel López 13/03/2025 una vez, con tiene_historico=true, nunca Miguel González
DO $$
DECLARE n1 integer; has_miguel1 boolean; n2 integer; has_miguel2 boolean;
  fecha1 date; fecha2 date; hist1 boolean; hist2 boolean;
BEGIN
  SELECT
    count(*) FILTER (WHERE source != 'libreto' OR tipo = 'propio'),
    bool_or(pg_temp.norm_eq(name, 'Miguel González')),
    (array_agg(scheduled_date) FILTER (WHERE name ILIKE '%ezequiel%' AND (source != 'libreto' OR tipo = 'propio')))[1],
    (array_agg(tiene_historico) FILTER (WHERE name ILIKE '%ezequiel%' AND (source != 'libreto' OR tipo = 'propio')))[1]
  INTO n1, has_miguel1, fecha1, hist1
  FROM public.buscar_invitados_rank('Ezequiel peralta', 20);

  SELECT
    count(*) FILTER (WHERE source != 'libreto' OR tipo = 'propio'),
    bool_or(pg_temp.norm_eq(name, 'Miguel González')),
    (array_agg(scheduled_date) FILTER (WHERE name ILIKE '%ezequiel%' AND (source != 'libreto' OR tipo = 'propio')))[1],
    (array_agg(tiene_historico) FILTER (WHERE name ILIKE '%ezequiel%' AND (source != 'libreto' OR tipo = 'propio')))[1]
  INTO n2, has_miguel2, fecha2, hist2
  FROM public.buscar_invitados_rank('ezequiel lopez', 20);

  IF NOT has_miguel1 AND fecha1 = '2025-03-13' AND hist1 = true
     AND NOT has_miguel2 AND fecha2 = '2025-03-13' AND hist2 = true THEN
    RAISE NOTICE 'PASS 7: "Ezequiel peralta" y "ezequiel lopez" -> Ezequiel López 2025-03-13 con tiene_historico, sin Miguel González';
  ELSE
    RAISE NOTICE 'FAIL 7: peralta(n=%,miguel=%,fecha=%,hist=%) lopez(n=%,miguel=%,fecha=%,hist=%)',
      n1, has_miguel1, fecha1, hist1, n2, has_miguel2, fecha2, hist2;
  END IF;
END $$;

-- 8. buscar_invitados_rank('«Miguel González»') -> igual que sin comillas
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
    RAISE NOTICE 'PASS 8: buscar_invitados_rank con comillas « » da el mismo resultado que sin comillas';
  ELSE
    RAISE NOTICE 'FAIL 8: con comillas=% sin comillas=%', con_comillas, sin_comillas;
  END IF;
END $$;

ROLLBACK;

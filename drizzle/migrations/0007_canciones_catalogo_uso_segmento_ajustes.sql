CREATE TABLE IF NOT EXISTS public.canciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  titulo_normalizado text GENERATED ALWAYS AS (lower(public.unaccent_immutable(titulo))) STORED,
  artista text,
  anio integer,
  catalogo text NOT NULL DEFAULT 'otros' CHECK (catalogo IN ('90s', 'en_vivo', 'otros')),
  es_cortinilla boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canciones_titulo_trgm ON public.canciones USING GIN (titulo_normalizado gin_trgm_ops);
CREATE UNIQUE INDEX IF NOT EXISTS idx_canciones_titulo_artista_unique
  ON public.canciones (titulo_normalizado, coalesce(lower(public.unaccent_immutable(artista)), ''));

CREATE OR REPLACE FUNCTION public.upsert_cancion(
  p_titulo text, p_artista text DEFAULT NULL, p_anio integer DEFAULT NULL,
  p_catalogo text DEFAULT 'otros', p_es_cortinilla boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_id uuid;
BEGIN
  SELECT c.id INTO result_id FROM public.canciones c
    WHERE c.titulo_normalizado = lower(public.unaccent_immutable(p_titulo))
      AND coalesce(lower(public.unaccent_immutable(c.artista)), '') = coalesce(lower(public.unaccent_immutable(p_artista)), '')
    LIMIT 1;

  IF result_id IS NULL THEN
    INSERT INTO public.canciones (titulo, artista, anio, catalogo, es_cortinilla)
    VALUES (p_titulo, p_artista, p_anio, coalesce(p_catalogo, 'otros'), coalesce(p_es_cortinilla, false))
    ON CONFLICT (titulo_normalizado, coalesce(lower(public.unaccent_immutable(artista)), '')) DO NOTHING
    RETURNING id INTO result_id;
  END IF;

  IF result_id IS NULL THEN
    SELECT c.id INTO result_id FROM public.canciones c
      WHERE c.titulo_normalizado = lower(public.unaccent_immutable(p_titulo))
        AND coalesce(lower(public.unaccent_immutable(c.artista)), '') = coalesce(lower(public.unaccent_immutable(p_artista)), '')
      LIMIT 1;
  END IF;

  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_cancion(text, text, integer, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_cancion(text, text, integer, text, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.upsert_cancion_segmento(
  p_cancion_id uuid, p_segmento text, p_day_of_week text DEFAULT NULL,
  p_hour_number integer DEFAULT NULL, p_es_firma boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_id uuid;
BEGIN
  INSERT INTO public.cancion_segmento (cancion_id, segmento, day_of_week, hour_number, es_firma)
  VALUES (p_cancion_id, p_segmento, p_day_of_week, p_hour_number, coalesce(p_es_firma, false))
  ON CONFLICT (cancion_id, segmento, coalesce(day_of_week, ''), coalesce(hour_number, -1))
  DO UPDATE SET es_firma = EXCLUDED.es_firma, updated_at = now()
  RETURNING id INTO result_id;
  RETURN result_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_cancion_segmento(uuid, text, text, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_cancion_segmento(uuid, text, text, integer, boolean) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.canciones_uso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cancion_id uuid NOT NULL REFERENCES public.canciones(id) ON DELETE CASCADE,
  fecha date,
  day_of_week text,
  hour_number integer,
  segmento text,
  guest_id uuid REFERENCES public.guests(id) ON DELETE CASCADE,
  source_file text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canciones_uso_cancion ON public.canciones_uso (cancion_id);
CREATE INDEX IF NOT EXISTS idx_canciones_uso_fecha ON public.canciones_uso (fecha);
CREATE INDEX IF NOT EXISTS idx_canciones_uso_segmento ON public.canciones_uso (segmento, fecha);
CREATE INDEX IF NOT EXISTS idx_canciones_uso_guest ON public.canciones_uso (guest_id);

CREATE TABLE IF NOT EXISTS public.cancion_segmento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cancion_id uuid NOT NULL REFERENCES public.canciones(id) ON DELETE CASCADE,
  segmento text NOT NULL,
  day_of_week text,
  hour_number integer,
  es_firma boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cancion_segmento_unique
  ON public.cancion_segmento (cancion_id, segmento, coalesce(day_of_week, ''), coalesce(hour_number, -1));

CREATE TABLE IF NOT EXISTS public.ajustes (
  clave text PRIMARY KEY,
  valor text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.ajustes (clave, valor) VALUES ('no_repeat_weeks', '8')
ON CONFLICT (clave) DO NOTHING;

ALTER TABLE public.canciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canciones_uso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancion_segmento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajustes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.canciones, public.canciones_uso, public.cancion_segmento, public.ajustes TO authenticated;
GRANT ALL ON public.canciones, public.canciones_uso, public.cancion_segmento, public.ajustes TO service_role;

DROP POLICY IF EXISTS "Authenticated can read canciones" ON public.canciones;
CREATE POLICY "Authenticated can read canciones" ON public.canciones FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Producers and admins manage canciones" ON public.canciones;
CREATE POLICY "Producers and admins manage canciones" ON public.canciones FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can read canciones uso" ON public.canciones_uso;
CREATE POLICY "Authenticated can read canciones uso" ON public.canciones_uso FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Producers and admins manage canciones uso" ON public.canciones_uso;
CREATE POLICY "Producers and admins manage canciones uso" ON public.canciones_uso FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can read cancion segmento" ON public.cancion_segmento;
CREATE POLICY "Authenticated can read cancion segmento" ON public.cancion_segmento FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Producers and admins manage cancion segmento" ON public.cancion_segmento;
CREATE POLICY "Producers and admins manage cancion segmento" ON public.cancion_segmento FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can read ajustes" ON public.ajustes;
CREATE POLICY "Authenticated can read ajustes" ON public.ajustes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Producers and admins manage ajustes" ON public.ajustes;
CREATE POLICY "Producers and admins manage ajustes" ON public.ajustes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.canciones (titulo, artista, catalogo)
SELECT 'Niña bonita', 'Maía', 'otros'
WHERE NOT EXISTS (
  SELECT 1 FROM public.canciones
  WHERE titulo_normalizado = lower(public.unaccent_immutable('Niña bonita'))
    AND coalesce(lower(public.unaccent_immutable(artista)), '') = lower(public.unaccent_immutable('Maía'))
);

INSERT INTO public.canciones (titulo, artista, catalogo)
SELECT 'Homenaje a los embajadores', 'Wganda Kenia', 'otros'
WHERE NOT EXISTS (
  SELECT 1 FROM public.canciones
  WHERE titulo_normalizado = lower(public.unaccent_immutable('Homenaje a los embajadores'))
    AND coalesce(lower(public.unaccent_immutable(artista)), '') = lower(public.unaccent_immutable('Wganda Kenia'))
);

INSERT INTO public.cancion_segmento (cancion_id, segmento, day_of_week, hour_number, es_firma)
SELECT id, 'miercoles_h2', 'wednesday', 2, true
FROM public.canciones
WHERE titulo_normalizado IN (
  lower(public.unaccent_immutable('Niña bonita')),
  lower(public.unaccent_immutable('Homenaje a los embajadores'))
)
ON CONFLICT (cancion_id, segmento, coalesce(day_of_week, ''), coalesce(hour_number, -1)) DO UPDATE
  SET es_firma = true, updated_at = now();

CREATE OR REPLACE FUNCTION public.sync_guest_canciones_uso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  day_offset int;
  fecha_emision date;
  spanish_day text;
  hour_num int;
  field_value text;
  old_field_value text;
  line text;
  titulo text;
  artista text;
  cancion_uuid uuid;
BEGIN
  IF NEW.day_of_week IS NULL OR NEW.week_date IS NULL THEN
    RETURN NEW;
  END IF;

  day_offset := CASE NEW.day_of_week
    WHEN 'monday' THEN 0 WHEN 'tuesday' THEN 1 WHEN 'wednesday' THEN 2 WHEN 'thursday' THEN 3
    ELSE NULL
  END;
  IF day_offset IS NULL THEN
    RETURN NEW;
  END IF;
  fecha_emision := NEW.week_date + day_offset;
  spanish_day := CASE NEW.day_of_week
    WHEN 'monday' THEN 'lunes' WHEN 'tuesday' THEN 'martes'
    WHEN 'wednesday' THEN 'miercoles' WHEN 'thursday' THEN 'jueves'
  END;

  FOR hour_num IN 1..3 LOOP
    field_value := CASE hour_num WHEN 1 THEN NEW.h1_canciones WHEN 2 THEN NEW.h2_canciones WHEN 3 THEN NEW.h3_canciones END;
    IF TG_OP = 'UPDATE' THEN
      old_field_value := CASE hour_num WHEN 1 THEN OLD.h1_canciones WHEN 2 THEN OLD.h2_canciones WHEN 3 THEN OLD.h3_canciones END;
      IF field_value IS DISTINCT FROM old_field_value THEN
        DELETE FROM public.canciones_uso WHERE guest_id = NEW.id AND hour_number = hour_num;
      ELSE
        CONTINUE;
      END IF;
    ELSE
      IF field_value IS NULL OR btrim(field_value) = '' THEN
        CONTINUE;
      END IF;
    END IF;

    IF field_value IS NULL OR btrim(field_value) = '' THEN
      CONTINUE;
    END IF;

    FOR line IN SELECT unnest(regexp_split_to_array(field_value, E'[\r\n;]+')) LOOP
      line := btrim(line);
      CONTINUE WHEN line = '';
      IF line ~ ' *- *' THEN
        titulo := btrim(substring(line FROM '^(.*?) *-[^-]*$'));
        artista := btrim(substring(line FROM '-([^-]*)$'));
      ELSE
        titulo := line;
        artista := NULL;
      END IF;
      CONTINUE WHEN titulo IS NULL OR titulo = '';

      cancion_uuid := public.upsert_cancion(titulo, artista, NULL, 'otros', false);

      INSERT INTO public.canciones_uso (cancion_id, fecha, day_of_week, hour_number, segmento, guest_id)
      VALUES (cancion_uuid, fecha_emision, NEW.day_of_week, hour_num, spanish_day || '_h' || hour_num, NEW.id);
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_guest_canciones_uso ON public.guests;
CREATE TRIGGER trg_sync_guest_canciones_uso
AFTER INSERT OR UPDATE OF h1_canciones, h2_canciones, h3_canciones ON public.guests
FOR EACH ROW
EXECUTE FUNCTION public.sync_guest_canciones_uso();
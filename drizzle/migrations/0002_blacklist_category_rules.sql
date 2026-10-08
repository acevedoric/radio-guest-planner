-- Categoría de la lista negra (actores / coaches-influencers-periodistas / comediantes)
-- y tabla de reglas editoriales generales (ej. nota de La Casa de los Famosos RCN).

ALTER TABLE public.blacklist ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE public.blacklist DROP CONSTRAINT IF EXISTS blacklist_category_check;
ALTER TABLE public.blacklist ADD CONSTRAINT blacklist_category_check
  CHECK (category IS NULL OR category IN ('actores', 'coaches_influencers_periodistas', 'comediantes'));

-- Backfill de los 38 nombres importados de BLACK LIST.docx según su sección original.
UPDATE public.blacklist SET category = 'actores' WHERE name IN (
  'Ana María Sánchez', 'Juan Pablo Raba', 'Jorge Enrique Abello', 'Víctor Mallarino',
  'Jorge Cao', 'Adriana Lucía', 'Julio Correal', 'Tiberio Cruz', 'María Irene Toro',
  'Ana Sofía Henao', 'Javier Gardeazabal', 'Lina Tejeiro', 'Isabella Santiago', 'Cony Camelo'
);

UPDATE public.blacklist SET category = 'coaches_influencers_periodistas' WHERE name IN (
  'Juan Diego Gómez', 'Tatiana Castro', 'Carmiña Villegas', 'El Tikuna', 'Profesor Salomón',
  'Sylvia Ramírez', 'Andrea Venturoli', 'Matador', 'Luis Carlos Vélez', 'María Paula Alonso'
);

UPDATE public.blacklist SET category = 'comediantes' WHERE name IN (
  'Antonio Sanint', 'Julián Arango', 'Valeria Aguilar', 'Valentina Taguado', 'Suso ''El Paspi''',
  'Luisa Vergara', 'Vicky Berrío', 'Ibrahim Salem', 'Julio Escallón', 'Pamela Ospina',
  'Camila Dever', 'Johana Velandia', 'Culotauro', 'Fuck News'
);

-- Reglas editoriales generales (no atadas a un nombre puntual).
CREATE TABLE IF NOT EXISTS public.blacklist_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blacklist_rules ENABLE ROW LEVEL SECURITY;

-- No es información sensible (es un aviso editorial, no un motivo sobre una persona):
-- visible también para anon, igual que se muestra en el formulario de invitado en vista pública.
DROP POLICY IF EXISTS "Anyone can read blacklist rules" ON public.blacklist_rules;
CREATE POLICY "Anyone can read blacklist rules"
ON public.blacklist_rules FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Producers and admins manage blacklist rules" ON public.blacklist_rules;
CREATE POLICY "Producers and admins manage blacklist rules"
ON public.blacklist_rules FOR ALL TO authenticated
USING (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

GRANT SELECT ON public.blacklist_rules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blacklist_rules TO authenticated;
GRANT ALL ON public.blacklist_rules TO service_role;

INSERT INTO public.blacklist_rules (text)
SELECT 'Cuidado con los futuros participantes y eliminados de la nueva versión de La Casa de los Famosos de RCN. Ninguno de esos puede estar.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.blacklist_rules
  WHERE text = 'Cuidado con los futuros participantes y eliminados de la nueva versión de La Casa de los Famosos de RCN. Ninguno de esos puede estar.'
);
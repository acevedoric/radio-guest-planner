-- Módulo 1: Tema Principal
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS tema_principal text NULL;
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS tema_principal_documento_url text NULL;
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS tema_principal_documento_nombre text NULL;

-- Módulo 2: Infancia y Vida Privada
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS infancia_vida_privada text NULL;

-- Módulo 3: Carrera Artística o Profesional
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS carrera_profesional text NULL;

-- Módulo 4: Datos Curiosos
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS datos_curiosos text NULL;

-- Timestamp de última actualización desde n8n
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS n8n_updated_at timestamp with time zone NULL;

-- Crear bucket para documentos de invitados
INSERT INTO storage.buckets (id, name, public)
VALUES ('guest-documents', 'guest-documents', true)
ON CONFLICT (id) DO NOTHING;

-- RLS para que productores/admins puedan subir archivos
CREATE POLICY "Producers and admins can upload guest documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'guest-documents' AND
  (public.has_role(auth.uid(), 'producer') OR public.has_role(auth.uid(), 'admin'))
);

-- RLS para que productores/admins puedan actualizar archivos
CREATE POLICY "Producers and admins can update guest documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'guest-documents' AND
  (public.has_role(auth.uid(), 'producer') OR public.has_role(auth.uid(), 'admin'))
);

-- RLS para que productores/admins puedan eliminar archivos
CREATE POLICY "Producers and admins can delete guest documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'guest-documents' AND
  (public.has_role(auth.uid(), 'producer') OR public.has_role(auth.uid(), 'admin'))
);

-- Lectura pública para documentos
CREATE POLICY "Anyone can read guest documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'guest-documents');
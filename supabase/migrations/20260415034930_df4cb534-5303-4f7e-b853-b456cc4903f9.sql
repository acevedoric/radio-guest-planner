
ALTER TABLE public.guests ADD COLUMN h2_info_personal text;
ALTER TABLE public.guests ADD COLUMN h2_preguntas_sugeridas text;
ALTER TABLE public.guests ADD COLUMN h2_documento_url text;
ALTER TABLE public.guests ADD COLUMN h2_documento_nombre text;
ALTER TABLE public.guests ADD COLUMN h2_link_info text;

ALTER TABLE public.guests ADD COLUMN h3_datos_personales text;
ALTER TABLE public.guests ADD COLUMN h3_comunicado_prensa text;
ALTER TABLE public.guests ADD COLUMN h3_documento_url text;
ALTER TABLE public.guests ADD COLUMN h3_documento_nombre text;
ALTER TABLE public.guests ADD COLUMN h3_link_info text;

ALTER TABLE public.guests ADD COLUMN h2_n8n_updated_at timestamptz;
ALTER TABLE public.guests ADD COLUMN h3_n8n_updated_at timestamptz;

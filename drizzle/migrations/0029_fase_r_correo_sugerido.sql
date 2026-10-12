ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS correo_sugerido text;
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS correo_fuente text;
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS social_followers jsonb;
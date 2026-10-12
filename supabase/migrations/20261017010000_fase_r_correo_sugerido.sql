-- FASE R: el correo que llega por redes/contacto profesional (n8n) o del
-- historial de un invitado anterior NUNCA se escribe directo en
-- guests.email/press_email -- es solo una sugerencia que el productor
-- confirma a mano. correo_fuente guarda de dónde salió ("n8n_redes" o
-- "invitado_anterior") para mostrarlo en el formulario.

ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS correo_sugerido text;
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS correo_fuente text;

-- Seguidores por red (aparte de social_networks, que guarda el handle
-- como string plano -- muchos lugares del frontend ya asumen eso, p.ej.
-- el formulario de edición manual). {"instagram": 12300, "tiktok": 500}
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS social_followers jsonb;

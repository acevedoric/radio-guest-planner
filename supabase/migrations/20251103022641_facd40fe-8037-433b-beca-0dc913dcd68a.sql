-- Agregar columna para número de teléfono de prensa
ALTER TABLE public.guests 
ADD COLUMN press_phone text;

-- Comentario descriptivo
COMMENT ON COLUMN public.guests.press_phone IS 'Número de teléfono del contacto de prensa (formato internacional con código de país)';
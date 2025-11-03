-- Agregar columna para la fecha específica según el estado
ALTER TABLE public.guests 
ADD COLUMN scheduled_date date;

-- Comentario descriptivo
COMMENT ON COLUMN public.guests.scheduled_date IS 'Fecha específica para grabar, aplazar o proponer. Se usa cuando recording_status es to_record, postponed o proposed';
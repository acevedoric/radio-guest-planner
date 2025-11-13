-- Agregar columnas para confirmaciones independientes
ALTER TABLE guests 
ADD COLUMN confirmed_blu boolean DEFAULT false NOT NULL,
ADD COLUMN confirmed_pr boolean DEFAULT false NOT NULL;

-- Migrar datos existentes de program_type a los nuevos campos
UPDATE guests 
SET confirmed_blu = true 
WHERE program_type = 'Blu';

UPDATE guests 
SET confirmed_pr = true 
WHERE program_type = 'PR';

-- Comentario: Mantenemos program_type por compatibilidad, pero ya no lo usaremos para confirmaciones
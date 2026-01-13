-- Add position field for guest's job/profession
ALTER TABLE guests 
ADD COLUMN position text NULL;

COMMENT ON COLUMN guests.position IS 'Cargo o profesión del invitado';
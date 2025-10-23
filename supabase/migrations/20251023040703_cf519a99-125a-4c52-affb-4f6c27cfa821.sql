-- Step 1: Drop the old constraint
ALTER TABLE public.guests 
DROP CONSTRAINT IF EXISTS guests_recording_status_check;
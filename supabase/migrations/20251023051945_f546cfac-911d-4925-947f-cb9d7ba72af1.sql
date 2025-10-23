-- Step 2: Update existing data to match new values
UPDATE public.guests 
SET recording_status = 'to_record' 
WHERE recording_status = 'no_recording';

UPDATE public.guests 
SET recording_status = 'postponed' 
WHERE recording_status = 'cancelled';
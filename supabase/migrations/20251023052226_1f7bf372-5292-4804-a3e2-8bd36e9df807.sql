-- Step 3: Add new constraint with updated values
ALTER TABLE public.guests
ADD CONSTRAINT guests_recording_status_check 
CHECK (recording_status IN ('live', 'recorded', 'to_record', 'postponed', 'proposed'));
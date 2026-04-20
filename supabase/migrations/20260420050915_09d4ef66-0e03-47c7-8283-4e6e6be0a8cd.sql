-- Make scheduling fields nullable to support unscheduled proposed guests
ALTER TABLE public.guests
  ALTER COLUMN week_date DROP NOT NULL,
  ALTER COLUMN day_of_week DROP NOT NULL,
  ALTER COLUMN time_slot DROP NOT NULL;

-- Trigger: require date fields unless guest is 'proposed'
CREATE OR REPLACE FUNCTION public.enforce_guest_scheduling()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.recording_status <> 'proposed' THEN
    IF NEW.week_date IS NULL OR NEW.day_of_week IS NULL OR NEW.time_slot IS NULL THEN
      RAISE EXCEPTION 'GUEST_SCHEDULING_REQUIRED: week_date, day_of_week and time_slot are required unless recording_status is proposed'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_guest_scheduling_trigger ON public.guests;
CREATE TRIGGER enforce_guest_scheduling_trigger
  BEFORE INSERT OR UPDATE ON public.guests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_guest_scheduling();
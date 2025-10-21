-- Create guests table for radio production planning
CREATE TABLE IF NOT EXISTS public.guests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  social_networks JSONB DEFAULT '{}'::jsonb,
  topic TEXT NOT NULL,
  recording_status TEXT NOT NULL DEFAULT 'no_recording' CHECK (recording_status IN ('live', 'recorded', 'no_recording', 'cancelled')),
  program_type TEXT,
  press_contact TEXT,
  notes TEXT,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday')),
  time_slot INTEGER NOT NULL CHECK (time_slot IN (1, 2, 3)),
  week_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (no authentication required)
CREATE POLICY "Allow all operations on guests" ON public.guests
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_guests_updated_at
  BEFORE UPDATE ON public.guests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for the guests table
ALTER TABLE public.guests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guests;
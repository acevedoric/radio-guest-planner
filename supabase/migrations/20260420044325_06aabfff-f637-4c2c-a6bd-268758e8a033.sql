ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS h1_notas_adicionales text,
  ADD COLUMN IF NOT EXISTS h2_notas_adicionales text,
  ADD COLUMN IF NOT EXISTS h3_notas_adicionales text;
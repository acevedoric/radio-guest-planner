ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS h1_periodista_voces_sonidos text,
  ADD COLUMN IF NOT EXISTS h1_lanzamiento_musical text,
  ADD COLUMN IF NOT EXISTS h2_periodista_voces_sonidos text,
  ADD COLUMN IF NOT EXISTS h2_lanzamiento_musical text;
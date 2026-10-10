-- FASE K: en español no existe el acento grave (à è ì ò ù) en nombres --
-- "Maira Pèrez"/"Germàn Puerta" son errores de tipeo/OCR de la fuente.
-- Corrige a agudo (á é í ó ú), mayúsculas y minúsculas, en guests.name e
-- invitados_historicos (guest_name, cargo, tema). guest_name_normalized es
-- una columna generada (unaccent de guest_name), se recalcula sola al
-- actualizar guest_name.
--
-- Corre el SELECT primero para ver cuántas filas se van a tocar; el UPDATE
-- es idempotente (no afecta filas que ya no tengan acento grave).

-- 1) Conteo previo (ejecutar y revisar antes del UPDATE):
SELECT
  (SELECT count(*) FROM public.guests WHERE name ~ '[àèìòùÀÈÌÒÙ]') AS guests_afectados,
  (SELECT count(*) FROM public.invitados_historicos
     WHERE guest_name ~ '[àèìòùÀÈÌÒÙ]' OR cargo ~ '[àèìòùÀÈÌÒÙ]' OR tema ~ '[àèìòùÀÈÌÒÙ]') AS historico_afectados;

-- 2) Corrección:
UPDATE public.guests
SET name = translate(name, 'àèìòùÀÈÌÒÙ', 'áéíóúÁÉÍÓÚ')
WHERE name ~ '[àèìòùÀÈÌÒÙ]';

UPDATE public.invitados_historicos
SET
  guest_name = translate(guest_name, 'àèìòùÀÈÌÒÙ', 'áéíóúÁÉÍÓÚ'),
  cargo = translate(cargo, 'àèìòùÀÈÌÒÙ', 'áéíóúÁÉÍÓÚ'),
  tema = translate(tema, 'àèìòùÀÈÌÒÙ', 'áéíóúÁÉÍÓÚ')
WHERE guest_name ~ '[àèìòùÀÈÌÒÙ]' OR cargo ~ '[àèìòùÀÈÌÒÙ]' OR tema ~ '[àèìòùÀÈÌÒÙ]';

-- 3) Verificación (debe dar 0 y 0):
SELECT
  (SELECT count(*) FROM public.guests WHERE name ~ '[àèìòùÀÈÌÒÙ]') AS guests_restantes,
  (SELECT count(*) FROM public.invitados_historicos
     WHERE guest_name ~ '[àèìòùÀÈÌÒÙ]' OR cargo ~ '[àèìòùÀÈÌÒÙ]' OR tema ~ '[àèìòùÀÈÌÒÙ]') AS historico_restantes;

## Plan: Ocultar datos sensibles en modo público (sin autenticar)

Actualmente los usuarios anónimos ven TODA la tabla `guests`, incluyendo teléfonos y correos del invitado y del jefe de prensa/PR/Manager. Vamos a ocultar esos campos para anónimos manteniendo acceso completo para usuarios autenticados (productor/admin).

### Campos sensibles a ocultar para anónimos
- `phone`, `email` (invitado)
- `press_contact`, `press_phone`, `press_email` (prensa/PR/Manager)
- Notas internas que puedan contener contactos: `internal_notes`

### Estrategia: política RLS dual + vista pública

Mantenemos la app leyendo de `public.guests` como hoy (un solo path de código), y a nivel SQL devolvemos `NULL` en los campos sensibles cuando el lector es anónimo.

### Migración SQL

1. **Reemplazar la policy SELECT para `anon`** sobre `guests`:
   - Borrar `"Anyone can view guests"` (FOR SELECT TO anon USING (true)).
   - Crear una vista `public.guests_public` con `security_invoker=on` que seleccione todas las columnas EXCEPTO las sensibles (devolviendo `NULL` en su lugar para mantener el shape del tipo TS).
   - **Alternativa más limpia (elegida):** mantener la policy SELECT para anon, pero la app anónima leerá de la vista. Para que sea seguro, también haremos que la policy de anon en la tabla base siga permitiendo SELECT de todas las columnas — lo cual NO oculta nada. 
   
   → Por eso usaremos enfoque real: **revocar SELECT a `anon` en columnas sensibles** mediante column-level privileges:
   ```sql
   REVOKE SELECT ON public.guests FROM anon;
   GRANT SELECT (id, name, position, theme, week_date, day_of_week, time_slot, hour, recording_status, scheduled_date, scheduled_time, confirmado_blu, confirmado_pr, social_links, modules, encuesta_pregunta, encuesta_hashtag, periodista_h1, lanzamiento_h1, periodista_h2, lanzamiento_h2, proposed_by, created_at, updated_at /* ... resto de columnas no sensibles */) ON public.guests TO anon;
   ```
   Las columnas `phone`, `email`, `press_contact`, `press_phone`, `press_email`, `internal_notes` NO se otorgan a `anon`.

2. **Ajustar el SELECT del cliente anónimo:** Supabase JS por defecto hace `select('*')`, lo cual fallará para anon porque pedirá columnas sin permiso. Para resolverlo sin duplicar código, crear una **vista `public.guests_anon`** que expone solo columnas seguras + `NULL as phone`, `NULL as email`, etc., con `security_invoker=on`, y `GRANT SELECT` a `anon`.

3. **En el cliente:** detectar `!session` y leer de `guests_anon` en lugar de `guests`. Un único helper `getGuestsTable()` que retorna `'guests'` o `'guests_anon'`. Aplicar en:
   - `src/pages/Index.tsx` (fetch principal)
   - `src/pages/SearchResults.tsx`
   - cualquier otro `from('guests').select(...)` de solo lectura.
   Las mutaciones (`insert/update/delete`) siguen apuntando a `guests` y solo las usan usuarios autenticados.

4. **UI en modo público (readonly):** en `GuestDetailModal` y vistas, los campos sensibles llegarán como `null`/vacío y simplemente no se renderizarán (ya hay checks `guest.phone && ...`). Confirmar que ContactLink/secciones de prensa se ocultan cuando todos los campos son null.

### Archivos modificados

| Archivo | Cambio |
|---|---|
| Nueva migración SQL | Crea vista `public.guests_anon` (security_invoker), revoca SELECT amplio a `anon` en `guests`, otorga SELECT solo a columnas no sensibles, GRANT SELECT en `guests_anon` a `anon`. Borra policy `"Anyone can view guests"` y crea policy equivalente sobre la vista si hace falta. |
| `src/lib/guestsSource.ts` (nuevo) | Helper `guestsReadTable(session)` → `'guests' \| 'guests_anon'`. |
| `src/pages/Index.tsx` | Usar helper en el fetch y en realtime (anon ya no se suscribe — no cambia). |
| `src/pages/SearchResults.tsx` | Usar helper. |
| `src/components/GuestDetailModal.tsx` | Verificar que renderiza condicionalmente cuando los campos sensibles son null (en modo público se abrirá readonly). |

### No incluye
- Cambios al login `@caracoltv.com.co`.
- Ocultar nombres de invitados (los nombres siguen siendo públicos — confírmame si también deben ocultarse).
- Filtrar contenido sensible dentro de `internal_notes` o `modules` más allá de excluir la columna entera.

### Pregunta para confirmar
¿`internal_notes` debe ocultarse también para anónimos? (Asumo que sí, por ser nota interna del productor.) ¿Y los `modules` —COYUNTURA/INFANCIA/CARRERA/CURIOSIDADES— deben verse en público o solo el `theme` principal?

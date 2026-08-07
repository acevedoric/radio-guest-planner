# Fecha de emisión propia y campos opcionales al guardar

## Qué cambia

1. **Nuevo campo "Fecha de emisión"** dentro del bloque SLOT DE EMISIÓN, independiente de la fecha de grabación.
   - Se elige la fecha en que sale al aire (lunes a jueves) y la hora de emisión (1ra, 2da, 3ra).
   - Si no hay fecha de emisión escrita, el botón ASIGNAR usa la fecha de grabación como antes.
   - Al asignar se sigue validando que el slot no esté ocupado.

2. **Nada es obligatorio para guardar un propuesto.**
   - Se puede guardar sin fecha de grabación, sin fecha de emisión y sin hora.
   - Un invitado propuesto que nunca se va a grabar queda igual de válido.
   - Para estados EN VIVO / GRABADO se mantiene la exigencia del slot de emisión (día + hora), porque sin eso no aparece en el calendario.

3. **Texto de ayuda más claro** en cada bloque: "Cuándo se graba" vs "Cuándo se emite".

## Detalles técnicos

- `src/components/GuestDetailModal.tsx`:
  - Nuevo estado local `emissionDate`, inicializado desde `week_date` + `day_of_week` del invitado (o vacío).
  - Input `type="date"` en el bloque SLOT DE EMISIÓN.
  - `handleAssignProposed` toma `emissionDate || formData.scheduled_date`, calcula `week_date` (lunes de esa semana) y `day_of_week`, y valida ocupación por `week_date + day_of_week + time_slot + slot_order`.
  - El selector de hora y ASIGNAR dejan de estar limitados al estado `proposed`: se muestran para cualquier estado editable.
  - Botón ASIGNAR habilitado cuando haya fecha (emisión o grabación) + hora.
  - `handleSubmit`: sin validaciones nuevas para `proposed`; se conserva la validación de slot para los demás estados.
- No se requiere columna nueva: la fecha de emisión se deriva y guarda en `week_date` + `day_of_week`, que ya usan las vistas Día/Semana/Mes.

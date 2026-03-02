

## Mover invitado al cambiar estado a "Aplazado"

### Comportamiento actual
Cuando se cambia el estado a "APLAZADO" y se selecciona una nueva fecha (`scheduled_date`), el invitado se guarda pero permanece en su dia y slot original. La fecha de aplazamiento queda como un campo informativo sin efecto real.

### Comportamiento deseado
Al guardar un invitado con estado "APLAZADO" y una `scheduled_date` seleccionada:
1. Calcular el nuevo `day_of_week` y `week_date` basado en la fecha seleccionada
2. Verificar que el slot del invitado en ese nuevo dia no este ocupado por otro invitado
3. Si esta libre: mover el invitado automaticamente (actualizar `day_of_week` y `week_date`)
4. Si esta ocupado: mostrar una alerta y no guardar, para que el usuario decida

### Cambios

| Archivo | Cambio |
|---------|--------|
| `src/pages/Index.tsx` | En `handleSaveGuest`, detectar cuando el estado es "postponed" con `scheduled_date`. Calcular el nuevo dia/semana, verificar disponibilidad del slot en la BD, y mover o alertar |

### Logica en `handleSaveGuest`

Cuando `recording_status === "postponed"` y hay `scheduled_date`:
1. Convertir `scheduled_date` a `day_of_week` (monday-thursday) y `week_date` (lunes de esa semana)
2. Validar que la fecha caiga en dia laboral (Lun-Jue). Si no, alertar
3. Consultar la BD: `SELECT * FROM guests WHERE week_date = X AND day_of_week = Y AND time_slot = Z AND id != guestId`
4. Si hay conflicto: `toast.error("El slot X del [dia] ya esta ocupado por [nombre]")` y no guardar
5. Si esta libre: actualizar `day_of_week`, `week_date` con los nuevos valores y guardar normalmente


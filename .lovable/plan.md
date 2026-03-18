

## Diagnóstico del problema

El bug está en las líneas 233-235 de `Index.tsx`:

```typescript
// Reubicar: cambiar week_date y day_of_week, mantener time_slot original
guestData.day_of_week = newDayOfWeek;
guestData.week_date = newWeekDateStr;
```

Cuando asignas a Paula Salamanca una grabación para el martes 24, el sistema **cambia su `day_of_week` de "wednesday" a "tuesday" y su `week_date`** — esto la saca del slot 3 del miércoles 25 donde está asignada para el programa en vivo.

**El error conceptual**: asignar una fecha/hora de grabación NO debería mover al invitado de su posición en el calendario. La grabación se define por `scheduled_date` + `scheduled_time`, mientras que la posición en el calendario (programa en vivo) se define por `week_date` + `day_of_week` + `time_slot`. Son cosas independientes.

## Solución

**Archivo: `src/pages/Index.tsx`** — Eliminar la reubicación automática (líneas 233-235).

Cuando el invitado tiene un estado de grabación (`to_record`, `postponed`, `proposed`) y se le asigna una `scheduled_date`:
- **Solo guardar** `scheduled_date` y `scheduled_time` en el registro.
- **NO modificar** `day_of_week`, `week_date` ni `time_slot`.
- El invitado permanece en su posición original del calendario (miércoles 25, slot 3).

### Cambio concreto

Reemplazar las líneas 233-236:
```typescript
// ANTES (incorrecto — mueve al invitado):
guestData.day_of_week = newDayOfWeek;
guestData.week_date = newWeekDateStr;

// DESPUÉS (correcto — no mover, solo validar la hora):
// No reubicar: el invitado mantiene su posición en el calendario.
// La grabación queda registrada en scheduled_date + scheduled_time.
```

La validación de conflictos por `scheduled_time` (líneas 159-231) se mantiene intacta — eso sigue siendo útil para evitar que dos grabaciones caigan a la misma hora.


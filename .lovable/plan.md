## Cambio
Mostrar todas las grabaciones y propuestos en las tiras por día de las vistas Semana y Mes, eliminando el límite de 2 + contador "+N más".

### `src/components/WeeklyCalendar.tsx`
- Cambiar `recordings.slice(0, 2).map` → `recordings.map` y eliminar el bloque `{recordings.length > 2 && (...)}`.
- Mismo cambio para `proposed`.

### `src/components/MonthView.tsx`
- Cambiar `scheduledRecordings.slice(0, 2).map` → `scheduledRecordings.map` y eliminar el `+N más` rojo.
- Mismo cambio para `proposedGuests` y su `+N más` azul.
- Actualizar el cálculo de altura para considerar todos los items:
  - `maxRecordings = Math.max(0, ...row.map(day => getScheduledRecordingsForDay(day).length))`
  - `maxProposed = Math.max(0, ...row.map(day => getProposedForDay(day).length))`
- `stripsHeight` y `recordingSectionMinHeight` se mantienen igual ya que dependen de esas vars.

## Archivos
- `src/components/WeeklyCalendar.tsx`
- `src/components/MonthView.tsx`
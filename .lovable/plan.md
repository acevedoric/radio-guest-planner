## Problema
En las vistas **Semana** y **Día**, los invitados con estado `proposed` aparecen en banners rojos con etiqueta `🔴 Grab:` / `● REC`, igual que los que se van a grabar. Deben distinguirse en **azul** con etiqueta `PROPUESTO`, como ya se hace en la vista Mes.

## Cambios

### 1. `src/components/WeeklyCalendar.tsx` — Separar PROPUESTO de REC en las tiras del día
- En `getRecordingsForDay`, dejar solo `to_record` y `postponed` (rojo/REC).
- Añadir `getProposedForDay` que filtre solo `proposed`.
- En el bloque de "Recording strips per day" (líneas 108-130), renderizar **dos grupos**:
  - Rojo existente: `🔴 Grab: {name}` para grabaciones.
  - Nuevo azul: `🔵 Prop: {name}` con clases `bg-blue-500/10 text-blue-600 dark:text-blue-400 border-l-2 border-blue-500 hover:bg-blue-500/20`, click llama a `onRecordingGuestClick?.(g)`.
- Mantener el límite de 2 visibles + contador "+N más" por grupo.

### 2. `src/components/DayView.tsx` — Separar el banner PROPUESTO del banner REC
- Dividir `scheduledRecordings` (líneas 136-143) en dos listas:
  - `scheduledRecordings`: `to_record` + `postponed` (rojo, `● REC`, "Grabación programada:").
  - `proposedForDay`: `proposed` (azul, `● PROPUESTO`, "Propuesto para grabar:").
- En el banner (líneas 254-270), renderizar ambas listas. Para `proposedForDay` usar `bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20`, texto `text-blue-600 dark:text-blue-400`.
- Mantener el `onClick` que abre el detalle del invitado.

## Notas técnicas
- Sin cambios en DB ni RLS.
- Reutiliza los mismos tokens azules ya usados en MonthView para consistencia.
- No se tocan otras vistas ni el modal de edición.

## Archivos a modificar
- `src/components/WeeklyCalendar.tsx`
- `src/components/DayView.tsx`
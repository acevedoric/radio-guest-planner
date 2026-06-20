## Cambios al estado PROPUESTO

### 1. Vista MES (`src/components/MonthView.tsx`)

Hoy, cualquier invitado con `scheduled_date` (incluido `proposed`) se pinta como una franja **roja** y muestra un badge **REC rojo**. Hay que separar visualmente PROPUESTO de las grabaciones reales.

- Separar `getScheduledRecordingsForDay` en dos listas:
  - `scheduledRecordings`: solo `to_record` y `postponed` (los que sí se van a grabar) → siguen en **rojo** con badge **REC**.
  - `proposedForDay`: solo `proposed` → se renderiza en **azul** con badge **PROPUESTO**.
- Renderizar ambos grupos en la cabecera del día:
  - Badge azul `PROPUESTO` (con contador si hay más de uno) al lado/abajo del badge REC, usando los tokens azules ya existentes (`bg-blue-500/20`, `text-blue-700`, etc., consistentes con `getStatusColor("proposed")`).
  - Las "tiras" de nombre debajo del número de día también en azul para los propuestos (borde y texto azul, fondo `bg-blue-500/10`), en rojo para los de grabación.
- Ajustar el cálculo de `recordingSectionMinHeight` para considerar ambos grupos (suma de tiras visibles, máx 2 por grupo).
- Click en badge azul `PROPUESTO` o en una tira azul: abre el detalle del invitado propuesto (`onRecordingGuestClick` o equivalente). Mantener el click en REC tal cual.

### 2. Bandeja de Propuestos (`src/components/ProposedView.tsx`)

- Mostrar la **fecha propuesta** en cada tarjeta (campo `scheduled_date`), formateada en español: `"Propuesta: 11 jun 2026"`. Si no tiene fecha, mostrar `"Sin fecha asignada"`.
- **Ordenar la lista** por `scheduled_date` ascendente (próximas primero). Los invitados sin fecha quedan al final.
- Mantener el botón "Asignar fecha" como hoy.

### Notas técnicas

- Tokens semánticos: usar las clases azules ya presentes en `getStatusColor` (no hardcodear hex).
- `date-fns` ya está disponible (`format(date, "d MMM yyyy", { locale: es })`); reutilizar el locale ya importado en otros archivos del proyecto.
- Sin cambios de base de datos ni de RLS. Sin cambios en el modal de edición.

### Archivos a modificar

- `src/components/MonthView.tsx`
- `src/components/ProposedView.tsx`

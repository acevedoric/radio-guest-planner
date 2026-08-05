## Objetivo
Mostrar la hora de grabación junto al nombre en los slots/franjas de grabación (y propuestos) de las vistas MES y SEMANA. La vista DÍA ya la muestra.

## Cambios

### 1. `src/components/MonthView.tsx`
- En las franjas rojas de grabación: mostrar `🔴 HH:MM Nombre` cuando `scheduled_time` exista (formato corto `HH:MM`, recortando los segundos).
- En las franjas azules de propuestos: mismo tratamiento (`🔵 HH:MM Nombre`).
- La hora se resalta ligeramente (`font-semibold`) para que se distinga del nombre; si no hay hora, se muestra sólo el nombre como hoy.
- Actualizar el `title` (tooltip) para incluir la hora.

### 2. `src/components/WeeklyCalendar.tsx`
- En las tiras diarias: `🔴 Grab: HH:MM Nombre` y `🔵 Prop: HH:MM Nombre`, con la misma lógica condicional y tooltip actualizado.

### 3. `src/components/DayView.tsx`
- Sin cambios: ya muestra `● REC ... - hora`.

## Notas técnicas
- `scheduled_time` viene como `HH:MM:SS`; se recorta con `.slice(0,5)`.
- Sólo cambios de presentación, sin tocar datos ni backend.

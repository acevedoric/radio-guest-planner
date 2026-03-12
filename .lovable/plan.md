
Objetivo: corregir la inconsistencia entre MES / SEMANA / DÍA al agendar invitados en fechas futuras (ej. 1 de abril).

1) Hallazgos (causa raíz)
- En `src/pages/Index.tsx`, `handleSaveGuest` fuerza `week_date` de invitados nuevos a `selectedWeek`:
  - `week_date: guest.id ? guest.week_date : format(selectedWeek, "yyyy-MM-dd")`
  - Esto ignora la `week_date` real enviada desde MES (`onAddGuest(..., weekDate)`), y termina guardando al invitado en la semana actual (ej. 11 de marzo).
- En la navegación MES → DÍA (`onDayClick` dentro del render de `MonthView` en `Index.tsx`), solo se cambia `selectedDay`, pero no `selectedWeek`.
  - Resultado: al hacer clic en 1 de abril, DÍA puede mostrar miércoles de otra semana.

2) Plan de implementación
- Archivo: `src/pages/Index.tsx`
  - Ajustar `handleSaveGuest` para que, al crear invitado, priorice `guest.week_date` (la fecha calculada desde MES) y use `selectedWeek` solo como fallback.
  - Ajustar `onDayClick` de `MonthView` para también hacer:
    - `setSelectedWeek(startOfWeek(day, { weekStartsOn: 1 }))`
    - luego `setSelectedDay(...)` y `setViewMode("day")`.

3) Resultado esperado
- Si agendas desde MES el 1 de abril, el invitado se guarda en la semana correcta (lunes 30 de marzo) y aparece en:
  - MES: celda del 1 de abril
  - SEMANA: semana del 30 de marzo
  - DÍA: miércoles 1 de abril (al navegar desde MES)

4) Validación (QA)
- Caso 1: crear/editar desde MES para 1 de abril y confirmar consistencia en 3 vistas.
- Caso 2: clic en 1 de abril en MES y verificar que DÍA abra esa fecha exacta.
- Caso 3: confirmar que creación desde SEMANA/DÍA sigue funcionando igual (sin regresiones).

5) Nota técnica
- No requiere cambios de backend ni base de datos; es un ajuste de lógica de estado/fecha en frontend.
- Si ya quedó un registro mal ubicado (ej. Hernán en 11 de marzo), después del fix habrá que reubicarlo una sola vez para corregir ese dato histórico.

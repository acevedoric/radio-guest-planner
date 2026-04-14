

## Plan: Agregar número de día en vistas DÍA y SEMANA + quitar etiquetas de hora en SEMANA

### Cambios

**1. Vista DÍA (`src/components/DayView.tsx`)**

- Usar `selectedDayDate` para extraer el número del día
- Cambiar el header de `"Lunes"` a `"Lunes 14"` (línea 155)
- Cambiar los botones de navegación de `"Lunes"` a `"Lunes 14"` (línea 148), calculando la fecha de cada día a partir de `selectedDayDate` y el offset del día

**2. Vista SEMANA (`src/components/WeeklyCalendar.tsx`)**

- En el header, cambiar `"Lunes"` a `"Lunes 14"` usando `selectedWeek` + `day.offset` para calcular el número del día (línea 102-103)
- Quitar la columna "Horario" del header y la columna de "1ra Hora / 2da Hora / 3ra Hora" de cada fila
- Cambiar el grid de `"150px repeat(4, 1fr)"` a `"repeat(4, 1fr)"` en header, recording strips y time slots grids

### Detalle técnico

- En WeeklyCalendar: `format(addDays(selectedWeek, day.offset), 'd')` da el número del día
- En DayView: parsear `selectedDayDate` para obtener el día, y calcular los días adyacentes para los botones de navegación
- Ambos ya importan `date-fns`

### Archivos a modificar
- `src/components/DayView.tsx`
- `src/components/WeeklyCalendar.tsx`


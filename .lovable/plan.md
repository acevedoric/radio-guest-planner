

## Plan: Alinear slots de invitados en vista MES

### Problema
Cuando algunos días tienen grabaciones (REC) y otros no, los strips de grabaciones empujan los slots de invitados hacia abajo, desalineándolos entre los días de la misma semana.

### Solución
Agrupar los días en filas de 4 (Lun-Jue por semana). Para cada fila, calcular el máximo de grabaciones visibles (máximo 2 strips mostrados). Luego, en cada día, reservar una altura fija para la sección de grabaciones basada en ese máximo, usando un `min-height` consistente. Así los 3 slots de invitados quedan siempre a la misma altura en todos los días de la misma fila.

### Cambios
**`src/components/MonthView.tsx`**:
1. Agrupar los días laborales en chunks de 4 (una fila por semana).
2. Para cada fila, calcular `maxRecordings = Math.max(...row.map(day => getScheduledRecordingsForDay(day).length))`.
3. En cada tarjeta de día, envolver la sección de grabaciones en un `div` con `min-height` calculada según `maxRecordings` de la fila (ej: `min-h-[X]` donde X depende del máximo).
4. Esto garantiza que la sección de slots comience siempre a la misma posición vertical dentro de cada fila.


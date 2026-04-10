

## Plan: Importar invitados históricos desde Excel

### Problema
Tienes un Excel (`Consolidado_Invitados_BBB_2.xlsx`) con invitados organizados por año/mes/dia con nombre, cargo y tema. Necesitas importar los datos de fechas anteriores a las que ya existen en la base de datos (antes de 2025-10-20), sin tocar los días que ya tienen invitados.

### Enfoque
Escribir un script Python que:
1. Copie el Excel al filesystem y lo lea con pandas
2. Identifique la estructura (hojas por año/mes, columnas de fecha/nombre/cargo/tema)
3. Convierta cada fila a un registro de invitado, calculando `day_of_week`, `time_slot` y `week_date` a partir de la fecha
4. Filtre los registros cuyo `week_date + day_of_week + time_slot` ya existan en la BD
5. Inserte los nuevos registros usando la herramienta de inserción de datos

### Mapeo de campos
| Excel | BD |
|-------|-----|
| Fecha (año/mes/dia) | `week_date` (lunes de esa semana), `day_of_week`, `scheduled_date` |
| Nombre | `name` |
| Cargo | `position` |
| Tema | `topic` |
| -- | `recording_status` = `'live'` (default) |
| -- | `time_slot` = asignado secuencialmente (1, 2, 3) por día |

### Pasos de implementación
1. Copiar el Excel y leerlo con pandas para inspeccionar las hojas y columnas exactas
2. Parsear todas las filas, construyendo la fecha completa desde año/mes/dia
3. Consultar la BD para obtener todas las combinaciones `(week_date, day_of_week, time_slot)` existentes
4. Solo insertar filas para slots que NO estén ocupados
5. Insertar en lotes usando el Supabase insert tool

### Regla clave
- **No se modifican datos existentes** -- solo se insertan invitados en slots vacíos de fechas que no están cubiertas actualmente




## Plan: Importar invitados desde Excel a Hora 1

### Contexto

El archivo `bla_bla_blu_invitados.xlsx` no se pudo inspeccionar en modo plan (parser devolvió vacío y exec está restringido). En modo implementación abriré el archivo con `pandas` para mapear sus columnas a la estructura de `guests`.

### Pasos

**1. Inspeccionar el Excel** (al pasar a modo implementación):
- `lov-copy user-uploads://bla_bla_blu_invitados.xlsx /tmp/inv.xlsx`
- Listar hojas y columnas con pandas
- Detectar mapeo: `name`, `position`, `topic`, `phone`, `email`, `week_date`, `day_of_week`, `time_slot`, `program_type` y, si existen, campos de Hora 2 (`h2_*`)

**2. Mapeo esperado** (basado en patrón del proyecto):

| Columna Excel (probable) | Campo BD |
|---|---|
| Fecha / Semana | `week_date` (lunes ISO) |
| Día | `day_of_week` (monday/tuesday/wed/thu) |
| Hora / Slot | `time_slot` (1, 2 o 3) |
| Nombre invitado | `name` |
| Cargo / Profesión | `position` |
| Tema | `topic` |
| Teléfono | `phone` |
| Correo | `email` |
| Tipo programa | `program_type` |

Si hay columnas de la **segunda hora** en la misma fila (ej. "Invitado H2", "Tema H2"), las inserto como un guest separado con `time_slot=2`.

**3. Generar script de inserción**:
- Crear migración SQL `INSERT INTO guests (...)` con todos los registros, o
- Usar la edge function `import-excel-guests` extendiéndola con los nuevos arrays

**Recomendado**: Insertar directamente vía `supabase--read_query` (INSERT), evitando duplicados con un check previo por `(name, week_date, day_of_week, time_slot)`.

**4. Validaciones antes de insertar**:
- `day_of_week` solo Lun–Jue (regla del proyecto)
- `week_date` siempre lunes (`date-fns startOfWeek`)
- `time_slot` ∈ {1, 2, 3}
- `recording_status` por defecto: `'live'` (igual que el import existente)
- Skip filas con `name` vacío

**5. Reporte final**: Cuántos registros se importaron, cuáles se omitieron y por qué (duplicados, datos faltantes).

### Archivos a tocar

| Archivo | Cambio |
|---|---|
| `/tmp/inspect.py` | Script temporal para leer el Excel y generar SQL |
| BD `guests` | INSERT vía `supabase--read_query` (insert) |

### Lo que NO incluye

- No modifica la edge function `import-excel-guests` (es histórica)
- No toca código de UI
- No importa Hora 3 a menos que el Excel la traiga explícita

### Confirmación necesaria al ejecutar

Si el Excel tiene una estructura ambigua (ej. fechas en formato distinto, días en español sin mapeo claro, o nombres de columna inesperados), te muestro las primeras filas y te pregunto antes de insertar nada en la BD.


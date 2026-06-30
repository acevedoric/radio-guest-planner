## Objetivo

Importación única (one-off) de los archivos `CALENDARIO BBB 2025/2026` al planner. Sin UI permanente para usuarios finales: un botón discreto en el header (solo admin) que abre un modal de import con preview y confirmación. Sin export por ahora (no es necesario para un import único; se puede añadir luego si lo pides).

## Formato detectado en tus archivos

- 1 hoja por mes (`ENERO`, `FEBRERO`, … o `AGOSTO`, `SEPT`, …) + hojas auxiliares `HORARIO` y `MOLDE` (se ignoran).
- Cada mes contiene varios **bloques de semana** separados por filas vacías. Estructura de cada bloque:
  - Fila cabecera: `None, None, "LUNES 29", "MARTES 30", "MIÉRCOLES 31", "JUEVES 1"` (col C–F).
  - Filas opcionales `GRABA` (col B = "GRABA"): grabaciones programadas que aluden a una franja futura (ej. `"3ra hora del lunes 28 julio"`).
  - 3 filas `VIVO/GRABADO` con etiqueta de hora (`1ra/2da/3ra hora`) y la fila de datos justo debajo con la celda de invitado.
- Columna B = tipo (`VIVO`, `GRABA`, `GRABADO`) y hora horaria.
- Las celdas de invitado son texto libre multilinea. No siempre traen `Invitado:/Tema:/Contacto:`. Pueden contener solo `NO HAY PROGRAMA`, `NO HAY GRABACIÓN`, o texto narrativo.

## Mapeo a la tabla `guests`

Por cada celda no vacía:

| Campo Excel | Campo `guests` |
|---|---|
| Día de la semana (col index) | `day_of_week` ∈ monday…thursday |
| Fila franja (1ra/2da/3ra) | `time_slot` 1/2/3 |
| Día numérico de la cabecera + mes (hoja) + año (filename) | `week_date` = lunes de esa semana |
| Bloque `VIVO` 1ra/2da hora | `recording_status = "live"` |
| Bloque `VIVO`/`GRABADO` 3ra hora | `recording_status = "recorded"` |
| Bloque `GRABA` | `recording_status = "to_record"` + `scheduled_date`/`scheduled_time` desde la hora de col B y la fecha de la cabecera; texto referencia (ej. "3ra hora del lunes 28 julio") → se intenta resolver `day_of_week`/`time_slot`/`week_date` destino con regex |
| Texto celda | parseo (ver abajo) |
| `NO HAY PROGRAMA/GRABACIÓN` | se omite |

### Parseo de la celda (texto libre)

Regex tolerante, sin orden fijo, campos opcionales:

- `Invitado[as]?:\s*(.+?)(?=\n[A-ZÁÉ]\w+:|$)` → `name`
- `Tema:\s*(.+?)(?=\n[A-ZÁÉ]\w+:|$)` → `topic`
- `Contacto:?\s*(.+?)(?=\n[A-ZÁÉ]\w+:|$)` → desde aquí extraer:
  - Primer `+?57\s?\d{3}\s?\d{7}` o variantes → `phone`
  - Texto entre paréntesis `(... Prensa)` → `press_contact`
- Si la celda no tiene ningún `Invitado:` reconocible, todo el texto va a `topic` y `name = ""`.

### Pendiente vs confirmado

- `name` vacío después de parseo → `recording_status = "proposed"` (mapea a tu "pendiente" azul existente) + `topic` = texto crudo.
- `name` presente → status según bloque (live/recorded/to_record).
- **Protección**: una vez insertado como confirmado, una re-importación nunca lo sobreescribe (ver dedupe).

## Dedupe (al re-importar)

Match por `(week_date, day_of_week, time_slot, normalizado(name))`:

1. No existe → INSERT.
2. Existe con mismo nombre → SKIP (no toca confirmados).
3. Existe en el slot con nombre distinto y el existente es `proposed` (pendiente) → UPDATE.
4. Existe en el slot con nombre distinto y el existente es confirmado → SKIP + reportar conflicto en el preview.

Las grabaciones (`to_record`) se deduplican por `(scheduled_date, scheduled_time, name)`.

## Inferencia de año

- Del nombre del archivo: regex `/(\d{4})/` sobre `file.name` → 2025 o 2026.
- Fallback: prompt en el modal (input numérico, default año actual).

## UX del importador

Modal con 3 pasos:

1. **Subir archivo** (`<input type="file" accept=".xlsx">`). Confirmar año detectado.
2. **Preview**: tabla con `Hoja | Semana | Día | Franja | Status | Nombre | Tema | Acción (insert/skip/update/conflict)`. Permite desmarcar filas individuales.
3. **Importar**: ejecuta inserts/updates con `supabase.from('guests')`, muestra resumen `X creados, Y actualizados, Z omitidos, N conflictos` y refresca el planner.

Botón de acceso: ícono `Upload` en el header del planner, visible solo para `admin` (consultando `user_roles`). Lo dejamos fácil de retirar tras la importación.

## Aspectos técnicos

- Librería: `xlsx` (SheetJS) instalada vía `bun add xlsx`. Parseo 100% en navegador.
- Nuevo archivo `src/components/ImportExcelModal.tsx` con todo el wizard y la lógica de parsing.
- Nuevo módulo `src/lib/excelImport.ts`:
  - `parseWorkbook(file, year): ParsedRow[]`
  - `mergeWithExisting(rows, currentGuests): PreviewRow[]`
  - `monthNameToIndex(sheetName)` y `weekDateFor(year, month, monLabel)` usando `date-fns` en zona local (cumple memoria de date formatting).
- En `src/pages/Index.tsx` (o donde esté el header), añadir botón `<ImportExcelModal />` condicionado a rol admin.
- Status `proposed` ya existe en `Guest['recording_status']`, no requiere migración.
- Sin tocar `src/integrations/supabase/client.ts` ni `types.ts`.
- No se agrega export por ahora.

## Lo que NO se hace (para mantener el alcance acotado)

- No se crea un export Excel (puedo añadirlo después, generando el mismo formato con `XLSX.utils.aoa_to_sheet`).
- No se persiste el archivo subido en storage.
- No se modifica RLS de `guests` (los inserts usan el usuario admin actual).

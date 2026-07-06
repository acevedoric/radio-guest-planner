## Objetivo

Permitir un segundo invitado dentro de la MISMA 3ra hora (mismo día/semana/franja) sin crear una franja 4. Se comporta como un "invitado 3B" que hereda las características del slot 3 (hora, status por defecto `recorded`, mismo `week_date`/`day_of_week`/`time_slot=3`). Debe ser visible y editable en Día, Semana y Mes.

## Modelo de datos

Añadir una columna `slot_order` (`smallint`, default `1`) a `guests`. La unicidad lógica de un slot pasa de `(week_date, day_of_week, time_slot)` a `(week_date, day_of_week, time_slot, slot_order)`.

- `slot_order = 1` → invitado principal (comportamiento actual).
- `slot_order = 2` → co-invitado de la 3ra hora.
- Solo se permite `slot_order = 2` cuando `time_slot = 3` (validado en UI; sin constraint duro para no romper importaciones existentes).
- Migración: backfill `slot_order = 1` para todas las filas actuales, `NOT NULL DEFAULT 1`. Índice `(week_date, day_of_week, time_slot, slot_order)`.

No se agregan nuevos campos de contenido: el co-invitado usa las mismas columnas que cualquier invitado (nombre, tema, contacto, redes, checkboxes, módulos H3, etc.).

## UI

### Vista DÍA (`src/components/DayView.tsx`)
- En la tarjeta de la 3ra hora, si NO existe co-invitado, mostrar un botón `(+) Agregar co-invitado` debajo del bloque del invitado principal.
- Al pulsar, abre el modal de creación pre-rellenado con `day_of_week`, `week_date`, `time_slot=3`, `slot_order=2`, `recording_status='recorded'`.
- Si existe co-invitado, renderizar una segunda tarjeta idéntica en estructura al invitado principal (mismos módulos H3, checkboxes CONF. BLU / CONF. PR, contactos, drag opcional deshabilitado entre orders para no romper la lógica actual).
- Botón para eliminar el co-invitado (solo en Edit mode) que borra la fila `slot_order=2`.

### Vista SEMANA (`src/components/WeeklyCalendar.tsx`)
- La celda de la 3ra hora pasa a poder contener 1 o 2 tarjetas apiladas verticalmente. Cuando hay co-invitado, se muestran ambas mini-tarjetas (nombre, posición, tema, checkboxes) con separador.
- El (+) para agregar co-invitado también aparece aquí en Edit mode si el slot 3 tiene principal pero no co-invitado.
- El drag & drop actual sigue moviendo únicamente al principal (`slot_order=1`); el co-invitado se mueve solo desde el modal de edición.

### Vista MES (`src/components/MonthView.tsx`)
- En la fila del día, la 3ra hora muestra los dos nombres separados por `/` o en dos líneas cortas cuando hay co-invitado. Mismos indicadores de status/REC.

### Modales / edición
- `GuestDetailModal` no cambia funcionalmente; solo respeta `slot_order` al guardar (se pasa como prop desde quien abre el modal).
- Al crear vía (+), se fuerza `slot_order=2` y `time_slot=3`.
- Al eliminar el principal (`slot_order=1`) cuando existe co-invitado, se pregunta si promover el co-invitado a principal (UPDATE `slot_order=1`) o borrar ambos.

## Lecturas / hooks

- `guestsSource.ts` y los queries del planner ya traen todas las filas del `week_date`; solo hay que dejar de asumir "una fila por (day, slot)". Se cambia el helper actual (`getGuestForSlot`) por dos: `getPrimaryForSlot(day, slot)` y `getCoGuestForSlot(day)` (solo aplica al slot 3).
- Orden estable en frontend: `ORDER BY slot_order`.

## Import Excel

No cambia: los imports actuales siguen creando `slot_order=1`. El co-invitado se crea manualmente desde la UI.

## Fuera de alcance

- Más de 2 invitados por hora.
- Co-invitado en hora 1 o 2.
- Cambios en el flujo de grabaciones (`to_record`) ni en `scheduled_date`.

## Detalles técnicos

- Migración SQL:
  ```sql
  ALTER TABLE public.guests
    ADD COLUMN slot_order smallint NOT NULL DEFAULT 1;
  CREATE INDEX guests_slot_order_idx
    ON public.guests (week_date, day_of_week, time_slot, slot_order);
  ```
- Actualizar `src/types/guest.ts` con `slot_order?: number`.
- Componentes tocados: `DayView.tsx`, `WeeklyCalendar.tsx`, `MonthView.tsx`, `GuestDetailModal.tsx` (solo props), `Index.tsx` (handlers de creación reciben `slotOrder`).
- Undo/redo: incluir `slot_order` en el snapshot de la fila.

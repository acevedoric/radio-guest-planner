

## Plan: Sección PROPUESTOS

### Contexto
El estado `proposed` ya existe en `recording_status` (ver `mem://features/guest-status-system`). Hoy un invitado propuesto vive dentro del calendario en una fecha/slot concreto. El usuario quiere un **bandeja separada** ("PROPUESTOS") para invitados sin fecha asignada, accesible desde un nuevo botón **P** junto a Día/Semana/Mes, y poder asignarles fecha + hora desde ahí.

También pide acortar **SEMANA → SEM** para que quepan los 4 botones (D / SEM / MES / P).

### Cambios

**1. Modelo de datos (migración)**
La tabla `guests` exige `week_date NOT NULL`, `day_of_week NOT NULL`, `time_slot NOT NULL`. Para guardar propuestos sin fecha:
- Hacer estas 3 columnas nullable.
- Añadir CHECK: si `recording_status <> 'proposed'` entonces los 3 deben ser NOT NULL (vía trigger, no CHECK, por la regla de no usar CHECK con lógica condicional fuerte).

**2. Tipo `Guest`**
`day_of_week`, `time_slot`, `week_date` pasan a opcionales.

**3. FilterBar (`src/components/FilterBar.tsx`)**
- Añadir cuarto botón **"P"** al selector de vista (`onViewModeChange("proposed")`).
- Cambiar etiqueta `"Semana"` → `"Sem"` en el botón.
- Tipo `viewMode`: `"day" | "week" | "month" | "proposed"`.
- En modo `proposed`, ocultar navegación prev/next y label de fecha (o mostrar "Propuestos" como título).

**4. Index (`src/pages/Index.tsx`)**
- Soportar `viewMode === "proposed"`.
- Renderizar nuevo `<ProposedView />` cuando aplique.
- Query: en lugar de filtrar por semana, traer `recording_status = 'proposed' AND week_date IS NULL`.

**5. Nuevo componente `src/components/ProposedView.tsx`**
- Lista vertical de tarjetas de propuestos (reusa estilo de `GuestCard` ya existente en DayView).
- Cada tarjeta muestra: nombre, posición, tema, propuesto por, contacto.
- Botón **"Asignar fecha"** por tarjeta → abre `GuestDetailModal` en modo edición con foco en los nuevos campos: 
  - Date picker (Shadcn Popover + Calendar, lun–jue solo) → setea `week_date` (lunes de esa semana) y `day_of_week`.
  - Selector hora (1, 2, 3) → setea `time_slot`.
  - Al guardar, si los 3 campos están completos, se permite cambiar también `recording_status` a otro estado o mantener `proposed`.
- Botón "Eliminar" reutilizando flujo existente.
- Vacío: mensaje "No hay invitados propuestos sin fecha".

**6. Crear propuesto sin fecha**
Añadir botón flotante "+ Nuevo propuesto" en `ProposedView` que abre el modal con `recording_status = 'proposed'` y campos de fecha vacíos.

**7. GuestDetailModal**
- Permitir guardar con fecha vacía SOLO si `recording_status === 'proposed'`.
- Si el usuario cambia el estado a otro y los campos de fecha están vacíos → bloquear guardado y mostrar error.

### Archivos

| Archivo | Cambio |
|---|---|
| Migración SQL | `week_date/day_of_week/time_slot` nullable + trigger que exige los 3 si status ≠ `proposed` |
| `src/types/guest.ts` | Hacer los 3 campos opcionales |
| `src/components/FilterBar.tsx` | Botón "P", "Semana" → "Sem", tipo viewMode |
| `src/pages/Index.tsx` | Manejar viewMode `proposed`, query separada |
| `src/components/ProposedView.tsx` (nuevo) | Lista de propuestos sin fecha + botón asignar + crear |
| `src/components/GuestDetailModal.tsx` | Permitir guardar sin fecha si status=proposed; date+hora picker |

### No incluye
- Migración de propuestos ya existentes (con fecha) a la bandeja sin fecha. Quedan donde están; los nuevos sin fecha aparecen en la bandeja P.
- Drag & drop desde la bandeja P al calendario (asignación es vía modal).


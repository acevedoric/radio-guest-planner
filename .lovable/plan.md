## Alinear CONF. BLU y CONF. PR en una sola línea

### Objetivo
Optimizar el espacio vertical en las tarjetas de invitado de las vistas Día, Semana y Mes colocando los checkboxes de confirmación **CONF. BLU** y **CONF. PR** en una misma línea horizontal, en lugar de apilados verticalmente.

### Cambios

#### 1. Vista Día (`src/components/DayView.tsx`)
- Localizar el bloque "Estado de Confirmación" (líneas ~441-483).
- Cambiar el contenedor de `flex flex-col gap-2` a `flex flex-row flex-wrap gap-4` (o `gap-3`).
- Mantener cada checkbox + label como un grupo `flex items-center space-x-2`.
- Preservar el `onClick={(e) => e.stopPropagation()}` para evitar abrir el modal al marcar.

#### 2. Vista Semana (`src/components/WeeklyCalendar.tsx`)
- Localizar los checkboxes del invitado principal (dentro de `GuestSlotCard`) y del co-invitado (`renderCoGuestMini`).
- Cambiar el contenedor padre de `space-y-1` / `pt-2 border-t border-muted space-y-1` a `flex flex-row gap-3`.
- Ajustar tamaños de texto si es necesario para que quepan en la mini-tarjeta.

#### 3. Vista Mes (`src/components/MonthView.tsx`)
- Localizar el bloque de checkboxes dentro de `SlotCard` (líneas ~408-445).
- Cambiar el contenedor de `mt-2 pt-2 border-t border-muted space-y-1` a `mt-2 pt-2 border-t border-muted flex flex-row gap-2`.
- Mantener los IDs únicos y el manejo de `stopPropagation`.

### Criterios de aceptación
- En Día, Semana y Mes, CONF. BLU y CONF. PR aparecen en la misma línea horizontal.
- Los checkboxes siguen funcionando en modo edición.
- En modo presentación (readonly) se mantienen visibles pero no interactivos.
- No se modifica ninguna lógica de datos ni backend.

### Archivos a tocar
- `src/components/DayView.tsx`
- `src/components/WeeklyCalendar.tsx`
- `src/components/MonthView.tsx`
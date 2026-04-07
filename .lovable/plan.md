

## Colorear slots por estado + eliminar checkbox PROPUESTO

### Cambios

**1. Vista SEMANA (`src/components/WeeklyCalendar.tsx`)**

- **Eliminar el Badge** de estado (líneas 255-257) de la tarjeta del invitado.
- **Colorear el fondo del Card** según el estado con opacidad 20%:
  - `live` → `bg-green-500/20 border-l-4 border-green-500`
  - `recorded` → `bg-red-500/20 border-l-4 border-red-500`
  - `to_record` → `bg-yellow-500/20 border-l-4 border-yellow-500`
  - `postponed` → `bg-gray-500/20 border-l-4 border-gray-500`
  - `proposed` → `bg-blue-500/20 border-l-4 border-blue-500`
- **Eliminar el checkbox PROPUESTO** (líneas 277-291), dejando solo CONF. BLU y CONF. PR.
- Aplicar lo mismo al DragOverlay.

**2. Vista MES (`src/components/MonthView.tsx`)**

- Cambiar `getStatusColor` para usar fondos al 20% con texto normal en vez de full color:
  - `live` → `bg-green-500/20 text-green-700 dark:text-green-400`
  - `recorded` → `bg-red-500/20 text-red-700 dark:text-red-400`
  - `to_record` → `bg-yellow-500/20 text-yellow-700 dark:text-yellow-400`
  - `postponed` → `bg-gray-500/20 text-gray-700 dark:text-gray-400`
  - `proposed` → `bg-blue-500/20 text-blue-700 dark:text-blue-400`
- Agregar `border-l-2` con el color sólido correspondiente para refuerzo visual.
- **Eliminar el checkbox PROPUESTO** del `SlotCard`, dejando solo CONF. BLU y CONF. PR.
- Ajustar textos de `text-white` a colores legibles sobre fondo claro.

### Archivos a modificar
- `src/components/WeeklyCalendar.tsx`
- `src/components/MonthView.tsx`


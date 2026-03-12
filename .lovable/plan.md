

## Plan: Corregir inconsistencia de fechas entre vistas

### Causa raíz

Hay una mezcla de dos métodos para convertir fechas a string:

- **MonthView** usa `format(date, "yyyy-MM-dd")` → zona horaria LOCAL
- **Index.tsx** y **WeeklyCalendar** usan `toISOString().split('T')[0]` → zona horaria UTC

Cuando el usuario está en una zona horaria con offset positivo (ej: UTC+1), `toISOString()` puede cambiar la fecha al día ANTERIOR. Ejemplo: lunes 30 de marzo 00:00 local (UTC+1) = domingo 29 de marzo 23:00 UTC. Resultado: el `week_date` guardado es "2026-03-29" en vez de "2026-03-30", y el invitado no aparece en la vista MES.

### Solución

Reemplazar TODOS los `toISOString().split('T')[0]` por `format(date, "yyyy-MM-dd")` de date-fns, que siempre usa la zona horaria local del usuario.

### Archivos a modificar

| Archivo | Líneas | Cambio |
|---------|--------|--------|
| `src/pages/Index.tsx` | 100, 111, 132, 156, 350 | 5 reemplazos de `toISOString().split('T')[0]` → `format(date, "yyyy-MM-dd")` |
| `src/components/WeeklyCalendar.tsx` | 89 | 1 reemplazo |
| `src/components/GuestDetailModal.tsx` | 32, 65 | 2 reemplazos (defaults del formulario) |

Total: 8 cambios mecánicos, mismo patrón en todos.


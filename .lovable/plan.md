

## Plan: Respuestas IA con enlaces a los días de los invitados

### Objetivo
Que las respuestas de la IA incluyan links clicables que lleven directamente a la vista DÍA del invitado mencionado.

### Cambios

**1. Edge Function `chat-guests` — Modificar prompt y respuesta**

- Instruir a la IA para que incluya referencias estructuradas en formato `[[nombre|day_of_week|week_date]]` cuando mencione invitados
- Además de `answer`, devolver también la lista de `guests` encontrados con sus datos (`name`, `day_of_week`, `week_date`) para que el frontend pueda construir links

Cambio en el system prompt:
```
Cuando menciones un invitado y su fecha, usa el formato [[nombre del invitado|day_of_week|week_date]] 
para que se genere un enlace. Ejemplo: [[Carlos Vives|tuesday|2025-04-08]]
```

Cambio en la respuesta:
```json
{ "answer": "texto con [[marcadores]]...", "guests": [...] }
```

**2. FilterBar — Renderizar links en la respuesta IA**

- Parsear el texto de `aiAnswer` buscando patrones `[[nombre|day_of_week|week_date]]`
- Reemplazar cada match con un `<button>` o `<a>` clicable que navegue a la vista DÍA correspondiente usando las props `onWeekChange`, `onDayChange` y `onViewModeChange`
- La navegación calcula el lunes de esa semana a partir de `week_date` y setea el `day_of_week`

Ejemplo visual: "Carlos Vives fue invitado el **martes 8 de abril de 2025** (link clicable) con tema: Nuevo álbum."

**3. FilterBar — Agregar props necesarias**

- El FilterBar ya recibe `onWeekChange`, `onDayChange` y `onViewModeChange`, así que no se necesitan props adicionales
- Crear función `navigateToGuestDay(weekDate, dayOfWeek)` que:
  - Calcula el lunes de la semana con `startOfWeek`
  - Llama `onWeekChange(monday)`, `onDayChange(dayOfWeek)`, `onViewModeChange("day")`
  - Limpia la búsqueda

### Archivos a modificar
| Archivo | Acción |
|---------|--------|
| `supabase/functions/chat-guests/index.ts` | Modificar prompt para incluir marcadores de enlace |
| `src/components/FilterBar.tsx` | Parsear marcadores en la respuesta IA y renderizar como links clicables |


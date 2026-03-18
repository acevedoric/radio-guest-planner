

## Diagnóstico

El problema es claro: la lógica de conflicto en `handleSaveGuest` (líneas 159-192) verifica conflictos por **`time_slot` (1, 2, 3)** — los bloques del programa en vivo (10pm, 11pm, 12am). Pero las grabaciones usan horarios distintos (4pm, 5pm, 6pm, 7pm) almacenados en **`scheduled_time`**.

Paula Salamanca está en el slot 3 del miércoles 25. Al intentar reubicarla al martes 24 para grabar, el sistema busca slots 1/2/3 ocupados ese día y los encuentra todos llenos (Andrea Guzmán, Germán Puerta, Carolina Ochoa). Pero eso es irrelevante — ella no necesita un slot del programa en vivo, solo necesita una `scheduled_time` libre (5:00 PM).

**Los invitados para grabación no compiten por los slots 1/2/3 del programa en vivo. Solo compiten entre sí por `scheduled_time`.**

## Solución

Cambiar la lógica de conflicto en `handleSaveGuest` para que los invitados con grabación (`to_record`, `postponed`, `proposed`) verifiquen conflictos por **`scheduled_time`** en lugar de por `time_slot`:

### Cambio en `src/pages/Index.tsx` (líneas 159-197)

**Lógica actual**: busca slots 1/2/3 ocupados → falla si los 3 están llenos.

**Lógica nueva**:
1. Si el invitado tiene `scheduled_time`, verificar si otro invitado en el mismo día destino ya tiene esa misma `scheduled_time` → conflicto real.
2. Si hay conflicto de hora, buscar horas libres (comparando contra todas las `scheduled_time` ocupadas ese día) y sugerir alternativas.
3. **No reasignar `time_slot`** — mantener el slot original del invitado en el calendario. La grabación se identifica por `scheduled_date` + `scheduled_time`, no por `time_slot`.

```typescript
// Pseudocódigo del cambio:
// 1. Buscar scheduled_times ocupados en el día destino
const { data: occupiedTimes } = await supabase
  .from('guests')
  .select('id, name, scheduled_time')
  .eq('scheduled_date', guestData.scheduled_date)
  .not('scheduled_time', 'is', null)
  .neq('id', guest.id);

// 2. Si la hora solicitada está ocupada, sugerir libres
const requestedTime = guestData.scheduled_time;
const takenTimes = occupiedTimes.map(t => t.scheduled_time);
if (takenTimes.includes(requestedTime)) {
  const allRecordingHours = ["16:00", "17:00", "18:00", "19:00"];
  const available = allRecordingHours.filter(h => !takenTimes.includes(h));
  toast.error(`${requestedTime} ya está ocupada. Horas libres: ${available.join(', ')}`);
  return false;
}

// 3. Reubicar solo week_date y day_of_week, mantener time_slot original
guestData.day_of_week = newDayOfWeek;
guestData.week_date = newWeekDateStr;
// NO cambiar guestData.time_slot
```

### Resultado esperado
- Paula Salamanca (slot 3, miércoles 25) puede asignarse a grabar el 24 de marzo a las 5:00 PM sin conflicto.
- Si la hora pedida está ocupada, el toast muestra las horas libres disponibles.
- El modal permanece abierto si hay conflicto (gracias al fix anterior de `Promise<boolean>`).


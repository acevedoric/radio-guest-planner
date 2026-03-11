

## Plan: Ordenar franjas por hora, corregir bug de invitado desaparecido, y agregar Undo/Redo

### 3 cambios

**1. Ordenar franjas de grabacion por hora**

En `MonthView.tsx`, `WeeklyCalendar.tsx`, y `DayView.tsx`: ordenar `scheduledRecordings` por `scheduled_time` antes de renderizar. Usar `.sort((a, b) => (a.scheduled_time || '').localeCompare(b.scheduled_time || ''))`.

**2. Bug: invitado desaparece al cambiar estado**

**Causa raiz**: En `handleSaveGuest` (Index.tsx linea 124), al guardar se sobreescribe `week_date` con `selectedWeek` (la semana que el usuario esta viendo actualmente). Si el usuario navego a otra semana para ver/editar un invitado, al guardar se mueve el invitado a la semana equivocada.

**Solucion**: Usar `guest.week_date` original cuando es una edicion (tiene `id`), y solo usar `selectedWeek` cuando es un invitado nuevo. Cambiar linea 124:

```typescript
week_date: guest.id ? guest.week_date : selectedWeek.toISOString().split('T')[0],
```

Igualmente para `day_of_week` y `time_slot`: respetar los valores originales del guest cuando es edicion, a menos que el `newGuestSlot` los override explicitamente.

**3. Undo/Redo en la barra superior**

Implementar un sistema de historial de acciones con deshacer/rehacer:

- Crear un hook `useUndoRedo` que mantenga una pila de acciones (cada accion guarda: tipo, guestId, datos anteriores, datos nuevos)
- Antes de cada `update`/`delete`/`insert` en la BD, guardar snapshot del estado anterior
- Botones Undo (⌘Z) y Redo (⌘Y) en el header, al lado del boton "Salir"
- Undo: restaura el estado anterior del guest en la BD
- Redo: re-aplica el cambio
- Maximo 20 acciones en el historial
- Atajos de teclado: Ctrl+Z / Ctrl+Y

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/MonthView.tsx` | Ordenar recordings por hora |
| `src/components/WeeklyCalendar.tsx` | Ordenar recordings por hora |
| `src/components/DayView.tsx` | Ordenar recordings por hora |
| `src/pages/Index.tsx` | Fix bug week_date, integrar undo/redo |
| `src/hooks/useUndoRedo.ts` | Nuevo hook para historial de acciones |


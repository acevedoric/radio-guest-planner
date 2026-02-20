
## Dos correcciones: Eliminación y Búsqueda

### Problema 1: La eliminación borra de la BD pero la pantalla no se actualiza

El flujo actual es:
- `handleDeleteGuest` en `Index.tsx` ejecuta el DELETE en la base de datos
- Muestra el toast "Invitado eliminado" (correcto)
- NO actualiza el estado local `guests` ni llama `fetchGuests()`
- La suscripción en tiempo real (realtime) debería disparar `fetchGuests()` automáticamente, pero es poco confiable y tiene un problema adicional: `fetchGuests` dentro del callback de realtime usa la versión "capturada" de `viewMode`/`selectedWeek` en el momento en que se creó la suscripción (closure stale), no la versión actual

Solución: Después de un DELETE exitoso, eliminar el invitado del estado local de forma inmediata con `setGuests(prev => prev.filter(g => g.id !== guestId))`. Esto garantiza que la pantalla se actualice al instante, sin depender del realtime.

### Problema 2: La búsqueda no encuentra invitados de otras semanas

El buscador filtra `filteredGuests` que viene de `guests`, y `guests` solo contiene los invitados de la semana/mes visible actualmente. Si un invitado está en otra semana, no está en memoria y el filtro nunca lo encontrará.

Solución: Cuando el usuario escribe en el buscador, hacer una consulta separada a la base de datos que busque en TODOS los registros (sin filtro de semana), y mostrar los resultados en un panel de búsqueda global debajo del input. Los resultados mostrarán el nombre, tema y fecha del invitado, con la posibilidad de hacer clic para navegar a esa semana/día.

---

### Detalles técnicos

**Archivo: `src/pages/Index.tsx`**

1. En `handleDeleteGuest`, después del `toast.success`, agregar:
   ```
   setGuests(prev => prev.filter(g => g.id !== guestId));
   ```
   Esto actualiza la lista local inmediatamente.

2. Agregar un nuevo estado `globalSearchResults` y `isSearching`.

3. Crear una función `searchAllGuests(query)` que cuando `searchQuery` tenga 3 o más caracteres, busque en la base de datos sin filtro de semana:
   ```
   supabase.from('guests').select('*')
     .or(`name.ilike.%${query}%,topic.ilike.%${query}%`)
     .limit(20)
   ```

4. Mostrar los resultados globales en un `Popover` o dropdown debajo del input de búsqueda, con nombre + tema + semana de cada invitado encontrado. Al hacer clic en uno, navegar a esa semana/día y abrir el modal.

**Archivo: `src/components/FilterBar.tsx`**

Adaptar el input de búsqueda para:
- Recibir una prop `onGlobalSearch` que se llame cuando el texto cambia
- Mostrar un listado de resultados globales debajo del input cuando hay resultados (`globalSearchResults`)
- Permitir hacer clic en un resultado para navegar a él

---

### Tabla de cambios

| Archivo | Cambio |
|---------|--------|
| `src/pages/Index.tsx` | Fix eliminación: `setGuests` inmediato tras DELETE. Agregar búsqueda global con query a BD |
| `src/components/FilterBar.tsx` | Panel de resultados de búsqueda global debajo del input |

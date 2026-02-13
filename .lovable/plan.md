

## Plan: Corregir flujo de IA y display de datos n8n

### Problema 1: Auto-trigger innecesario
Al guardar o crear un invitado en Hora 1, el sistema llama automaticamente al webhook de n8n, gastando tokens sin que el usuario lo solicite.

**Solucion**: Eliminar las llamadas automaticas a `triggerN8nScraping` en `Index.tsx` (lineas 124-127 y 137-140). Solo se disparara manualmente con el boton de Sparkles.

### Problema 2: n8n devuelve body vacio
El test del webhook confirma que n8n responde 200 pero **sin datos en el body**. El log dice: `n8n raw response:` (vacio).

**Esto requiere accion tuya en n8n**: En tu workflow, el nodo "Respond to Webhook" debe estar configurado para devolver los datos. Por ejemplo, en el campo "Response Body" del nodo, usa la expresion que mencionaste para que devuelva un JSON con los 4 campos.

No hay cambio de codigo necesario aqui - el edge function ya soporta el campo `output`.

### Problema 3: La UI no se actualiza tras recibir datos
En `DayView.tsx`, el callback `onGuestUpdate` solo hace `console.log`. Cuando el edge function devuelve datos exitosamente, la UI no se refresca.

**Solucion**: Modificar `DayView.tsx` para que `onGuestUpdate` actualice el estado local del guest, forzando un re-render con los nuevos datos.

### Cambios

| Archivo | Accion |
|---------|--------|
| `src/pages/Index.tsx` | Eliminar auto-trigger de n8n al crear/actualizar guest (lineas 124-127 y 137-140) |
| `src/components/DayView.tsx` | Actualizar `onGuestUpdate` para refrescar el estado del guest en la UI |

### Accion requerida en n8n (fuera de Lovable)

Tu nodo "Respond to Webhook" debe devolver un JSON como este:

```text
{
  "output": {
    "tema_principal": "...",
    "infancia_vida_privada": "...",
    "carrera_profesional": "...",
    "datos_curiosos": "..."
  }
}
```

O si usas la expresion que mencionaste, asegurate de que el nodo "Respond to Webhook" tenga configurado el Response Body con los datos del scraping.

### Detalles tecnicos

**Index.tsx** - Eliminar auto-trigger:
```text
- Eliminar lineas 124-127 (trigger al actualizar guest)
- Eliminar lineas 137-140 (trigger al crear guest)
- Mantener la funcion triggerN8nScraping por si se necesita en otro contexto
  (o eliminarla si ya no se usa en ningun otro lugar)
```

**DayView.tsx** - Refrescar UI:
```text
- Cambiar onGuestUpdate de console.log a una funcion que:
  1. Reciba el Partial<Guest> con los datos actualizados
  2. Llame a una prop o callback que actualice el guest en el array
     de guests del componente padre (Index.tsx)
  3. El re-render mostrara los datos en los 4 bloques
```

Flujo de propagacion:
```text
GuestInfoModules (handleTriggerAI)
  -> Edge Function devuelve data_saved: true
  -> Re-fetch guest de BD
  -> onGuestUpdate(updatedGuest)
  -> DayView recibe actualizacion
  -> Actualiza guests[] en Index.tsx
  -> Re-render con datos en los 4 modulos
```


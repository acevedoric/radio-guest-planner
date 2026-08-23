# Mostrar el bloque de grabación solo en ciertos estados

## Qué cambia

En el modal de invitado, el bloque "Fecha y hora de grabación" (fecha de grabación / aplazamiento + hora de grabación) solo se mostrará cuando el estado sea:

- A GRABAR (`to_record`)
- PROPUESTO (`proposed`)
- APLAZADO (`postponed`)

En EN VIVO (`live`) y GRABADO (`recorded`) el bloque queda oculto, dejando visible únicamente el bloque de "Slot de emisión".

## Detalles técnicos

- Archivo: `src/components/GuestDetailModal.tsx`.
- Envolver el bloque de grabación (líneas ~384-418) en una condición sobre `formData.recording_status`.
- Los valores guardados de `scheduled_date` / `scheduled_time` no se borran al ocultar el bloque; solo se oculta la UI.
- El botón ASIGNAR sigue funcionando igual (usa la fecha de emisión y, si está vacía, la de grabación).

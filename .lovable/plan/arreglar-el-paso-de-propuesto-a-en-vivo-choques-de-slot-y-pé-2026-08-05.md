# Arreglar el paso de PROPUESTO a EN VIVO (choques de slot y pérdida de fecha)

## Qué está pasando (verificado en la base de datos)

Consulta actual:

- **Brian Mina** → EN VIVO, miércoles 12 de agosto, 1ra hora, sin fecha ni hora de grabación.
- **Kraken** → EN VIVO, miércoles 12 de agosto, 1ra hora.

Los dos quedaron en el **mismo slot**: no hay ninguna validación que impida ocupar un slot ya tomado, por eso Brian "reemplazó" visualmente a Kraken (ambos existen, pero se pisan en la vista).

Además, al cambiar el estado de PROPUESTO a EN VIVO el formulario **borra `scheduled_date` y `scheduled_time`**, que era donde vivía "12 de agosto, 2 pm" (y cualquier propuesta previa de septiembre). Por eso la información de grabación desapareció.

## Qué se va a corregir

1. **Validar el slot antes de guardar**
   Al guardar (o al pulsar ASIGNAR), verificar si ya hay un invitado en esa semana + día + hora + posición. Si está ocupado:
   - mostrar un aviso claro: "Miércoles 12, 1ra hora ya está ocupada por Kraken",
   - ofrecer las horas libres de ese día (1ra, 2da, 3ra) y la opción de co-invitado en 3ra hora,
   - no guardar hasta que el usuario elija una alternativa.

2. **No borrar la fecha/hora de grabación al cambiar de estado**
   Pasar a EN VIVO o GRABADO deja de anular `scheduled_date` / `scheduled_time`; se conservan como registro de la grabación. Solo se limpian si el usuario los borra manualmente.

3. **Separar visualmente los dos conceptos en el modal**
   - "Fecha y hora de grabación" (cuándo se graba: 12 ago, 2 pm)
   - "Slot de emisión" (día laboral + 1ra/2da/3ra hora)
   Con textos de ayuda para que quede claro que asignar el slot no cambia la grabación.

4. **Reparar los datos actuales**
   Dejar a Kraken en su slot original (miércoles 12, 1ra hora) y mover a Brian Mina a un slot libre, restaurando su grabación del 12 de agosto a las 14:00. Su fecha de septiembre no quedó guardada en la base de datos, así que se necesita el dato para reponerlo.

## Detalles técnicos

- `src/pages/Index.tsx` (`handleSaveGuest`): añadir chequeo de ocupación por `week_date + day_of_week + time_slot + slot_order` excluyendo el propio `id`, con toast de horas libres y `return false`.
- `src/components/GuestDetailModal.tsx`: quitar el reseteo de `scheduled_date`/`scheduled_time` en el `onValueChange` de estado; `handleAssignProposed` consulta ocupación antes de fijar el slot; reordenar y reetiquetar los campos en dos bloques.
- Reparación de datos vía migración puntual de UPDATE sobre las dos filas afectadas.

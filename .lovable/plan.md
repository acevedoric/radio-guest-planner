## Cambios en el modal Editar Invitado (estado PROPUESTO)

### UI: fila de "Fecha Propuesta"
Reorganizar el bloque condicional cuando `recording_status === "proposed"` para que en una sola fila aparezcan tres elementos:

```text
[ Fecha Propuesta (date) ] [ Hora (dropdown) ] [ ASIGNAR (botón) ]
```

- **Dropdown Hora**: nuevo `Select` con label "Hora", opciones:
  - `1` → "1ra hora"
  - `2` → "2da hora"
  - `3` → "3ra hora"
  - Valor por defecto: vacío (placeholder "Selecciona hora").
  - Estado local (no se persiste como columna nueva; alimenta `time_slot` al asignar).
- **Botón ASIGNAR**: estilo similar a GUARDAR (mismo `Button` variante primaria), deshabilitado mientras falten `scheduled_date` o la hora elegida, o si `readOnly`.

### Comportamiento de ASIGNAR
Al hacer clic:
1. Calcular `week_date` (lunes de la semana de `scheduled_date`) y `day_of_week` (lun=1 … jue=4) a partir de la fecha propuesta, usando `date-fns` en zona local (regla del proyecto: nunca `toISOString`).
2. Validar que el día caiga Lun–Jue; si no, mostrar toast de error y abortar.
3. Setear en `formData`:
   - `week_date`, `day_of_week`, `time_slot` (= hora del dropdown).
   - `recording_status` se mantiene en `"proposed"` (el invitado sigue en azul).
4. No cierra el modal ni guarda automáticamente — solo rellena los campos de scheduling. El usuario debe pulsar GUARDAR para persistir (mismo patrón que el resto del formulario).
5. Toast informativo: "Slot asignado: <día> · <hora>ra hora. Pulsa Guardar para confirmar."

### Notas técnicas
- Archivo único: `src/components/GuestDetailModal.tsx` (líneas ~273–307).
- Nuevo `useState<number | "">("")` para la hora propuesta, reseteado cuando cambia el invitado editado.
- No se requieren migraciones: `time_slot`, `week_date`, `day_of_week` ya existen y el trigger `enforce_guest_scheduling` permite valores aunque el estado sea `proposed`.
- Mantener el resto del formulario intacto (sin tocar lógica de otros estados).

### Archivos
- `src/components/GuestDetailModal.tsx`

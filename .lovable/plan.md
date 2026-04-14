

## Plan: Correo pre-llenado para confirmar invitados con PR

### Cambio
Modificar el botón "Correo PR" en `src/components/DayView.tsx` (línea ~396) para que el `mailto:` incluya asunto y cuerpo pre-llenados con los datos del invitado.

### Detalle

**Archivo:** `src/components/DayView.tsx`

1. Crear una función helper `buildPRMailto(guest, selectedDayDate)` que construya un `mailto:` con:
   - **To:** `guest.press_email`
   - **Subject:** `Confirmación de entrevista - [nombre del invitado]`
   - **Body:** Texto pre-llenado con:
     - Saludo al contacto de prensa (`press_contact`)
     - Nombre del invitado
     - Cargo (`position`)
     - Tema (`topic`)
     - Fecha de la entrevista (`selectedDayDate` formateada en español)
     - Solicitud de confirmación
     - Cierre cordial

2. Reemplazar el `mailto:${guest.press_email}` simple (línea 396) por la llamada a esta función.

3. También actualizar el botón "Enviar Correo" del invitado directo (línea 358) con un mailto pre-llenado similar pero dirigido al invitado.

### Ejemplo del correo generado

```
Asunto: Confirmación de entrevista - Juan Pérez

Estimado/a [press_contact],

Le escribimos para confirmar la participación de Juan Pérez (Director de Marketing) en nuestro programa.

Tema: Tendencias digitales 2025
Fecha: Martes, 15 de abril de 2025

Quedamos atentos a su confirmación.

Saludos cordiales.
```

### Archivos a modificar
- `src/components/DayView.tsx` — agregar helper y actualizar los onClick de ambos botones de correo


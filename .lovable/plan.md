

## Autocompletado inteligente de invitados y contactos de prensa

### Problema
Cuando María McCausland (u otro jefe de prensa) propone invitados que ya han aparecido antes, hay que rellenar manualmente teléfono, correo, cargo, redes sociales, datos de prensa, etc. — aunque esos datos ya existen en la base de datos.

### Solución
Agregar **autocompletado predictivo** en dos campos del modal:

1. **Campo "Nombre" del invitado** — al escribir 3+ caracteres, buscar en la DB invitados previos con nombre similar. Si el usuario selecciona uno, auto-rellenar: `position`, `phone`, `social_networks` (twitter, instagram, etc.).

2. **Campo "Contacto de Prensa"** — al escribir 3+ caracteres, buscar jefes de prensa previos. Si selecciona uno, auto-rellenar: `press_phone`, `press_email`.

### Comportamiento
- Aparece un dropdown debajo del campo con sugerencias (nombre + cargo para invitados, nombre + email para prensa).
- Solo se activa en modo **nuevo invitado** o cuando el campo está vacío al editar.
- Al seleccionar una sugerencia, se rellenan los campos relacionados pero **no se sobreescriben campos que ya tengan valor**.
- El `topic`, `recording_status`, fechas y slot **nunca** se auto-rellenan (son específicos de cada aparición).
- Las búsquedas son queries directas a la tabla `guests` agrupando por nombre (usando `DISTINCT` o deduplicación en el frontend).

### Cambios técnicos

**Archivo: `src/components/GuestDetailModal.tsx`**
- Agregar estado para sugerencias de invitado y sugerencias de prensa.
- En el campo `name`: al cambiar el texto (debounce 300ms), hacer query:
  ```sql
  SELECT DISTINCT ON (name) name, position, phone, social_networks
  FROM guests WHERE name ILIKE '%texto%' LIMIT 5
  ```
- En el campo `press_contact`: al cambiar el texto (debounce 300ms):
  ```sql
  SELECT DISTINCT ON (press_contact) press_contact, press_phone, press_email
  FROM guests WHERE press_contact ILIKE '%texto%' AND press_contact IS NOT NULL LIMIT 5
  ```
- Renderizar dropdown posicionado debajo de cada input con las sugerencias.
- Al hacer clic en una sugerencia, aplicar los campos al `formData` y `socialNetworks`/`customFields`.

**No se necesitan nuevas tablas ni edge functions** — todo se resuelve con queries a la tabla `guests` existente.

### Archivos a modificar
- `src/components/GuestDetailModal.tsx` — lógica de búsqueda, dropdown de sugerencias, auto-rellenado


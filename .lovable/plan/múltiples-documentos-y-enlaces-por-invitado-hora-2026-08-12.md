# Múltiples documentos y enlaces por invitado/hora

## Estado actual verificado

- La tabla `guest_documents` **no existe** en la base de datos actual (solo hay `guests`, `guests_anon`, `user_roles`, `allowed_emails`, `access_requests`). El componente `GuestDocuments.tsx` ya está escrito pero hoy fallaría.
- Cada hora guarda **un solo** documento en columnas de `guests` (`tema_principal_documento_url/nombre`, `h2_documento_*`, `h3_documento_*`) y un solo enlace (`h2_link_info`, `h3_link_info`).
- El bucket `guest-documents` existe y es **privado**, así que los enlaces se abren con URLs firmadas (no públicas).
- El webhook de scraping (`trigger-n8n-scraping`) envía hoy `document_url` y `document_name` sueltos.

## Qué se va a construir

### 1. Base de datos
- Crear `guest_documents`: invitado, número de hora, nombre de archivo, ruta del archivo, tipo, tamaño, fecha de subida.
- Crear `guest_urls`: invitado, número de hora, url, etiqueta opcional, fecha de creación.
- Permisos: productores y administradores pueden ver, crear y borrar; lectura anónima no permitida para estas tablas (coherente con la política de datos sensibles ya aplicada).
- Políticas de Storage sobre `guest-documents` para subir/leer/borrar con esos mismos roles.

### 2. Documentos por hora (H1, H2, H3)
En el detalle del invitado, en cada hora:
- Zona de arrastrar y soltar con soporte de **varios archivos a la vez** (PDF, Word, imágenes, cualquier tipo).
- Botón "+" para seleccionar archivos uno a uno.
- Ruta de subida: `{guest_id}/{hour_number}/{timestamp}_{file_name}`.
- Lista con nombre (abre el archivo mediante enlace firmado de 1 hora), tipo, tamaño en KB/MB, fecha y botón de eliminar (borra en Storage y en la tabla).
- Modo edición: subida y borrado activos. Modo presentación: solo lista de lectura.

### 3. Enlaces de referencia por hora (nuevo)
- Campo de texto + botón "+" para agregar un URL; se valida que empiece por `http://` o `https://`.
- Campo opcional de etiqueta descriptiva.
- Lista con etiqueta o URL truncado (abre en pestaña nueva) y botón eliminar en modo edición.
- Los campos actuales `h2_link_info` / `h3_link_info` se conservan y se muestran como el primer enlace de la lista para no perder datos existentes.

### 4. Payload del scraping n8n
El botón de IA de cada hora pasará a enviar:

```json
{
  "guest_id": "...", "name": "...", "position": "...", "topic": "...",
  "hour_number": 1,
  "documents": [{ "file_name": "...", "file_url": "...", "file_type": "..." }],
  "reference_urls": ["https://..."],
  "document_url": "...", "document_name": "...",
  "callback_url": "..."
}
```

- `documents` y `reference_urls` siempre presentes (arrays vacíos si no hay nada).
- Compatibilidad: `document_url` / `document_name` siguen enviándose con el primer documento.
- Los `file_url` se generan como enlaces firmados con vigencia amplia para que n8n pueda descargarlos.

## Detalles técnicos

- Migración SQL con `CREATE TABLE` + `GRANT` + RLS + políticas para ambas tablas, y políticas de Storage por bucket.
- Nuevo componente `GuestUrls.tsx` y ajuste de `GuestDocuments.tsx` (cambiar `getPublicUrl` por ruta guardada + `createSignedUrl`, ya que el bucket es privado).
- `GuestInfoModules.tsx`: reemplazar el bloque de documento único por `GuestDocuments` + `GuestUrls` filtrados por `slot`, y reconstruir el payload de `handleTriggerAI`.
- `supabase/functions/trigger-n8n-scraping/index.ts`: ampliar el esquema Zod con `documents`, `reference_urls`, `hour_number`, manteniendo los campos antiguos opcionales, y reenviarlos a n8n.
- Estilos con los tokens y componentes shadcn ya usados en la app.

## Nota

La política sugerida `USING (true)` para `guest_urls` dejaría los enlaces visibles para cualquier visitante anónimo (la app ya tiene modo público de solo lectura). Se aplicarán en su lugar políticas por rol productor/administrador, coherentes con `guests`.

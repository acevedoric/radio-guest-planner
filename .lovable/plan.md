

## Plan: Sección TITULARES + Botones ENVIAR CORREO / ENVIAR WHATSAPP

### 1. Sección TITULARES (parte superior de vista DÍA)

Justo después del selector de días y el header, agregar una card resumen con los 3 invitados del día:

```text
┌─────────────────────────────────────────┐
│  📋 TITULARES                           │
│                                         │
│  1ra hora: Juan Pérez — Tema X          │
│  2da hora: María López — Tema Y         │
│  3ra hora: (vacío)                      │
└─────────────────────────────────────────┘
```

Muestra nombre, posición y tema de cada slot. Si está vacío, indica "Sin invitado".

### 2. Botones ENVIAR CORREO y ENVIAR WHATSAPP (parte inferior de cada invitado)

Después de los checkboxes de confirmación, agregar dos grupos de botones:

- **Contactar Invitado**: ENVIAR CORREO / ENVIAR WHATSAPP (usa `guest.email` y `guest.phone`)
- **Contactar PR**: ENVIAR CORREO / ENVIAR WHATSAPP (usa `guest.press_contact` como email y `guest.press_phone`)

Los botones solo aparecen si el dato de contacto existe.

### 3. Edge Function para el webhook de n8n

Crear `supabase/functions/send-guest-notification/index.ts` que:
- Recibe: `guest_id`, `contact_type` ("guest" | "pr"), `channel` ("email" | "whatsapp")
- Consulta los datos del invitado en la tabla `guests`
- Envía un POST al webhook de n8n (usando el secreto `N8N_WEBHOOK_URL` existente, o un nuevo secreto `N8N_NOTIFICATION_WEBHOOK_URL` si se prefiere separar)
- El payload incluye: nombre, email/teléfono del destinatario, tema, fecha, hora, tipo de canal

### 4. Flujo del frontend

Al hacer clic en ENVIAR CORREO o ENVIAR WHATSAPP:
1. Confirmación con dialog ("¿Enviar correo a Juan Pérez?")
2. Llama a la edge function con `supabase.functions.invoke('send-guest-notification', ...)`
3. Toast de éxito/error

### Archivos a modificar/crear

| Archivo | Cambio |
|---------|--------|
| `src/components/DayView.tsx` | Agregar sección TITULARES arriba y botones de contacto abajo en cada card |
| `supabase/functions/send-guest-notification/index.ts` | Nueva edge function para enviar al webhook de n8n |
| `supabase/config.toml` | Registrar la nueva función con `verify_jwt = false` |

### Nota sobre secretos

Se necesitará un nuevo secreto `N8N_NOTIFICATION_WEBHOOK_URL` para la URL del webhook de n8n que maneje notificaciones (correo + calendar). Alternativamente puedo reutilizar `N8N_WEBHOOK_URL` si el mismo flujo de n8n maneja ambas cosas. Te preguntaré antes de implementar.


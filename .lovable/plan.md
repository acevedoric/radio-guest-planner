

## Plan: Enviar topic y documento al webhook de n8n

### Cambios necesarios

**1. Frontend — `src/components/GuestInfoModules.tsx` (handleTriggerAI)**

Agregar `topic` (tema a tratar) al payload. Si el invitado tiene un documento adjunto (`tema_principal_documento_url`), generar una URL firmada temporal y enviarla también.

```typescript
// Antes de invocar la función:
let document_url = null;
if (guest.tema_principal_documento_url) {
  const { data } = await supabase.storage
    .from("guest-documents")
    .createSignedUrl(guest.tema_principal_documento_url, 3600);
  document_url = data?.signedUrl || null;
}

const { data, error } = await supabase.functions.invoke('trigger-n8n-scraping', {
  body: {
    guest_id: guest.id,
    name: guest.name,
    position: guest.position || '',
    topic: guest.topic || '',
    document_url,
    document_name: guest.tema_principal_documento_nombre || null
  }
});
```

**2. Edge Function — `supabase/functions/trigger-n8n-scraping/index.ts`**

- Actualizar `TriggerPayload` para incluir `topic`, `document_url` y `document_name` (opcionales).
- Agregar estos campos al `n8nPayload` que se envía al webhook.
- n8n recibirá: `name`, `position`, `topic`, `document_url` (URL firmada válida 1 hora), `document_name`.

```typescript
const n8nPayload = {
  guest_id: payload.guest_id,
  name: payload.name,
  position: payload.position,
  topic: payload.topic || '',
  document_url: payload.document_url || null,
  document_name: payload.document_name || null,
  callback_url: callbackUrl
};
```

### Resultado
- n8n recibe nombre, cargo y tema a tratar siempre.
- Si hay documento justificativo, n8n recibe una URL temporal para descargarlo y procesarlo.
- No se modifica la lógica de respuesta ni el guardado en DB.

### Archivos a modificar
- `src/components/GuestInfoModules.tsx`
- `supabase/functions/trigger-n8n-scraping/index.ts`


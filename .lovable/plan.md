

## Fix: evitar enviar `document_url: null` a n8n

### Problema
Cuando un invitado no tiene documento adjunto, la Edge Function envía `document_url: null` en el payload. El nodo "HTTP Request" de n8n intenta usar ese valor como URL y falla con "Invalid URL: null".

### Solución
En `supabase/functions/trigger-n8n-scraping/index.ts`, construir el payload condicionalmente: solo incluir `document_url` y `document_name` cuando realmente tienen un valor. Así n8n puede verificar si el campo existe antes de intentar usarlo.

### Cambio

**`supabase/functions/trigger-n8n-scraping/index.ts`** (líneas 146-154)

Antes:
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

Después:
```typescript
const n8nPayload: Record<string, string> = {
  guest_id: payload.guest_id,
  name: payload.name,
  position: payload.position,
  topic: payload.topic || '',
  callback_url: callbackUrl
};

if (payload.document_url) {
  n8nPayload.document_url = payload.document_url;
}
if (payload.document_name) {
  n8nPayload.document_name = payload.document_name;
}
```

Esto hace que n8n no reciba el campo `document_url` cuando no hay documento, evitando que el nodo HTTP Request intente hacer fetch a `null`.

**Nota importante para n8n**: en tu workflow, el nodo HTTP Request que usa `document_url` debe tener una condición (IF node) que verifique si `{{ $json.document_url }}` existe antes de ejecutarse. Si ya la tienes, con este cambio debería funcionar correctamente.


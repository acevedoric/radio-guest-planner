

## Plan: Actualizar secreto N8N_WEBHOOK_URL

Actualizar el secreto `N8N_WEBHOOK_URL` de su valor actual (`https://n8npanel.iamigo.com.mx/webhook/scraping`) al nuevo valor: `https://ctv.app.n8n.cloud/webhook/scraping`.

### Acción
- Usar la herramienta `add_secret` para establecer el nuevo valor del secreto `N8N_WEBHOOK_URL`.

### Impacto
- La Edge Function `trigger-n8n-scraping` comenzará a enviar las solicitudes de scraping al nuevo servidor de n8n de forma inmediata.
- No se requieren cambios en el código.




## Plan: Actualizar secreto N8N_WEBHOOK_URL

Usar la herramienta `add_secret` para actualizar el valor del secreto `N8N_WEBHOOK_URL` con la nueva URL `https://ctv.app.n8n.cloud/webhook/scraping`.

Este cambio aplica inmediatamente a todas las Edge Functions que usan `Deno.env.get('N8N_WEBHOOK_URL')`, incluyendo `trigger-n8n-scraping`.


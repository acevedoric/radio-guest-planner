

## Plan: Actualizar URL del Webhook de n8n

### Accion unica

Actualizar el secreto `N8N_WEBHOOK_URL` con el valor:
`https://n8npanel.iamigo.com.mx/webhook/scraping`

El codigo ya esta listo. Las dos funciones backend (`trigger-n8n-scraping` y `n8n-guest-info`) ya estan implementadas y no requieren cambios. Solo falta apuntar al webhook correcto.

### Que pasa despues

Una vez actualizado el secreto:
- Al presionar el boton de IA (Sparkles) en cualquier modulo de un invitado de Hora 1, se enviara la solicitud al webhook
- n8n procesara la informacion y la devolvera al callback para llenar los 4 bloques automaticamente


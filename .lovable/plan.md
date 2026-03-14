

## Plan: Sección TITULARES + Botones de Contacto (sin n8n)

### 1. Sección TITULARES
Agregar una card resumen después del header del día y antes del banner de grabaciones, mostrando los 3 slots:

- **1ra hora**: Nombre (Posición) — Tema
- **2da hora**: Nombre (Posición) — Tema  
- **3ra hora**: Sin invitado

Usa un icono de `Newspaper` y estilo compacto con fondo sutil.

### 2. Botones ENVIAR CORREO / ENVIAR WHATSAPP
Al final de cada card de invitado (después de los checkboxes de confirmación), agregar dos grupos:

- **Contactar Invitado**: botones de correo (si tiene `email`) y WhatsApp (si tiene `phone`)
- **Contactar PR**: botones de correo y WhatsApp (si tiene `press_contact` / `press_phone`)

Por ahora, los botones de correo abren `mailto:` y los de WhatsApp abren `https://wa.me/`. Cuando se configure n8n, se reemplazará con la llamada al webhook.

### Archivo a modificar
- `src/components/DayView.tsx`

### Cambios específicos
1. Importar `Mail`, `MessageCircle`, `Newspaper` de lucide-react
2. Después del Day Header (línea ~111), insertar la card TITULARES que itera sobre TIME_SLOTS y muestra el resumen
3. Después de los checkboxes de confirmación (línea ~304), agregar sección de botones de contacto con dos columnas: Invitado y PR


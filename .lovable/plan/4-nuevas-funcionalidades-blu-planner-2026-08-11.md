# 4 nuevas funcionalidades — blu-planner

Se implementan tras conectar el Supabase externo (`sasufaphjchzfhmimovb`), que ya tiene la tabla `guest_documents`, el bucket `guest-documents` y la función `buscar_invitado`. No se crean ni modifican tablas, buckets ni funciones.

Las URLs de n8n quedan como constantes en un archivo de configuración del frontend, con placeholders que reemplazarás por las reales.

## 1. Documentos múltiples por invitado

Nueva sección "Documentos" en la vista de detalle del invitado, debajo de la información existente:

- Zona de arrastrar y soltar (o selección) que acepta varios archivos a la vez, de cualquier tipo.
- Cada archivo se sube al bucket con la ruta `{guest_id}/{hour_number}/{timestamp}_{nombre}` y se registra en `guest_documents` con nombre original, tipo MIME, tamaño y la hora que se está viendo.
- Lista de documentos agrupada por Hora 1 / Hora 2 / Hora 3, mostrando nombre (clickeable para abrir), tipo, tamaño formateado (KB/MB), fecha de subida y botón de eliminar que borra del bucket y de la tabla.
- Barra de progreso durante la subida y avisos de error por archivo.
- Subir y eliminar solo en modo edición; en modo presentación la lista es de solo lectura.

## 2. Búsqueda en libretos históricos (RAG)

- Ícono de lupa nuevo en la barra superior, con la etiqueta "Buscar en libretos históricos".
- Abre un panel lateral con un campo de búsqueda; al enviar se consulta la función `buscar_invitado` (hasta 10 resultados).
- Cada resultado se muestra como tarjeta: nombre, rol, año, día, hora, un extracto de 200 caracteres con el término resaltado, y un indicador visual de relevancia (barra + porcentaje).
- Botón "Usar como referencia" que copia el contenido completo al portapapeles y confirma con un aviso.
- Sin resultados: "No se encontraron coincidencias en los libretos históricos."
- Estados de carga y error contemplados.

## 3. Botón "Agendar en calendario"

- Botón "📅 Agendar" en la vista de detalle, visible solo si el invitado tiene fecha y hora de grabación.
- Envía el invitado (nombre, cargo, tema, email, contacto y email de prensa, fecha, hora, hora del programa y día) al webhook de agendamiento.
- Muestra spinner durante el envío; éxito → "Evento creado en Google Calendar"; error → aviso con el mensaje devuelto.
- Tras un envío exitoso el botón queda deshabilitado y pasa a "✅ Agendado", recordado por invitado para evitar duplicados.

## 4. Correo automático al PR

- Se dispara cuando "CONFIRMADO BLU" y "CONFIRMADO PR" quedan ambos en verdadero, desde cualquier vista (Día, Semana, Mes y ficha de detalle).
- Envía los datos del invitado y su programación al webhook de confirmación.
- Éxito: "Correo de confirmación enviado a [contacto de prensa]".
- Sin email de PR: "No hay email del PR registrado — correo no enviado." y no se envía nada.
- Se envía una sola vez por invitado; si se desmarcan y vuelven a marcar los checks no se reenvía.

## Detalles técnicos

- Requisito previo: conexión al Supabase externo. Sin ella, `guest_documents`, el bucket y `buscar_invitado` no existen y estas funciones fallarán en tiempo de ejecución.
- Nuevos archivos: `src/lib/webhooks.ts` (constantes `WEBHOOK_URL_AGENDAR` / `WEBHOOK_URL_CONFIRMACION` + helper de POST y control de reenvío), `src/components/GuestDocuments.tsx`, `src/components/HistoricalSearchDialog.tsx`, `src/hooks/useConfirmationWebhook.ts`.
- Archivos modificados: `GuestDetailModal.tsx` (sección Documentos + botón Agendar + disparo de confirmación), `DayView.tsx`, `WeeklyCalendar.tsx`, `MonthView.tsx` (disparo de confirmación al marcar checkboxes), `Index.tsx` (lupa en la barra superior).
- Los tipos generados de la base se regeneran tras la conexión; mientras tanto la RPC y la tabla nuevas se tipan localmente.
- Control anti-duplicados de ambos webhooks en `localStorage` por `guest_id`.
- Se reutilizan los componentes shadcn y tokens de diseño ya usados en la app.

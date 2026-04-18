

## Plan: Mejorar correo al invitado (fecha, hora, saludo neutro)

### Contexto

Actualmente la función "ENVIAR CORREO" al invitado se construye en `DayView.tsx` (o componente similar) usando `mailto:` con un cuerpo prellenado. Hay que:

1. Cambiar saludo de "Estimado/a [nombre]" → "Hola, qué tal [nombre]".
2. Incluir siempre **fecha y hora**:
   - Si el invitado es **EN VIVO** (`recording_status='live'`) → fecha de emisión (`week_date`+`day_of_week`) + hora del bloque (`time_slot`: 22:00 / 23:00 / 00:00).
   - Si es **A GRABAR / GRABADO** (`recording_status='to_record'` o `'recorded'`) → además incluir `scheduled_date` + `scheduled_time` con etiqueta clara "Fecha y hora de grabación".

### Exploración necesaria

- Localizar dónde se arma el `mailto:` actual del invitado (probablemente `DayView.tsx` o un helper). Confirmar que también existe el de WhatsApp para aplicar el mismo cambio de tono.
- Verificar el mapeo `time_slot → hora` ya usado en el proyecto (10 PM, 11 PM, 12 AM según memoria de patrones recurrentes).

### Cambios

**Archivo: `src/components/DayView.tsx`** (y/o helper de mensajes)

- Función `buildGuestEmailBody(guest)`:
  - Saludo: `Hola, qué tal ${guest.name}`
  - Fecha de emisión formateada en español: `EEEE d 'de' MMMM 'de' yyyy` (date-fns + locale `es`).
  - Hora de emisión según `time_slot`: 1→10:00 p.m., 2→11:00 p.m., 3→12:00 a.m.
  - Si `recording_status` ∈ {`to_record`,`recorded`} y existe `scheduled_date`:
    - Añadir bloque: "📹 Grabación: [fecha] a las [scheduled_time]"
  - Mantener referencia al tema (`topic`) y firma del programa.

- Aplicar el mismo saludo neutro al cuerpo de **WhatsApp** del invitado para coherencia.
- **No** modificar los mensajes a contactos de prensa (esos pueden conservar tono formal salvo que el usuario indique lo contrario).

### Ejemplo de cuerpo resultante

```
Hola, qué tal Juan,

Te confirmamos tu participación en Bla Bla Blu.

📅 Fecha de emisión: martes 22 de abril de 2025
🕙 Hora: 10:00 p.m.

📹 Grabación: lunes 21 de abril de 2025 a las 3:00 p.m.

Tema: Lanzamiento del nuevo álbum.

¡Te esperamos!
Equipo Bla Bla Blu
```

(El bloque "Grabación" solo aparece si aplica.)

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/DayView.tsx` | Reescribir constructor de cuerpo de email/WhatsApp del invitado: saludo neutro + fecha/hora emisión + (condicional) fecha/hora grabación |

### Lo que NO incluye

- No cambia los mensajes al contacto de prensa.
- No envía emails desde el servidor (sigue siendo `mailto:` que abre el cliente del usuario).
- No toca plantillas de auth/transaccional.


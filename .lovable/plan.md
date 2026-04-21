

## Plan: Mejorar la generación del libreto en vista DÍA con prompt especializado

El usuario tiene un prompt detallado para producir libretos de **Bla Bla BLU**. Lo integraremos como un asistente IA dentro de la vista DÍA que genere/sugiera el libreto a partir de los invitados ya cargados ese día.

### Cambios

**1. Nueva edge function `generate-libreto`**
- Input: `{ date: 'yyyy-MM-dd' }`.
- Server-side: lee de `guests` los 3 invitados de ese día (slots 1/2/3) con todos sus campos (nombre, cargo, tema, redes sociales, press contact, datos curiosos, etc.).
- Detecta el día de la semana → escoge la plantilla (Lun/Mar/Mié/Jue) del prompt.
- Construye el `system prompt` con las **REGLAS GENERALES + ESTRUCTURA POR DÍA + CIERRE 2H** literales del mensaje del usuario.
- Construye el `user prompt` con los datos reales: día, fecha, invitados con redes/seguidores/motivo, periodista de Voces y Sonidos, lanzamiento musical (si están guardados; si faltan, instruir al modelo a marcar `[FALTA: …]` en lugar de inventar).
- Llama a `google/gemini-2.5-pro` (mejor para texto largo estructurado en español) vía Lovable AI Gateway.
- Devuelve `{ libreto: string }`.
- Auth: requiere JWT del usuario (igual que `chat-guests`).

**2. UI en `DayView.tsx`**
- Nuevo botón **"Generar libreto IA"** (icono `Sparkles`) en la cabecera de la vista DÍA, junto al título de TITULARES, visible solo en `editMode` (mantiene el patrón de `mem://features/ai-action-buttons-modules`).
- Al hacer clic:
  - Llama a la edge function con la fecha actual.
  - Muestra un `Dialog` con el libreto generado, scrollable, con botones **"Copiar"** y **"Descargar .docx"**.
  - Estado de carga con spinner; manejo de 429/402 con toast.
- Si faltan invitados clave (ej. ningún invitado en slot 1), muestra un toast "Asigna al menos el invitado de la primera hora" y no llama a la IA.

**3. Campos opcionales del día (mini-formulario antes de generar)**
Antes de llamar a la IA, abrir un pequeño modal pidiendo los datos que NO viven en la tabla `guests`:
- Periodista de Voces y Sonidos (texto)
- Canción/artista de lanzamiento musical (texto)
- (Miércoles) Canciones 90s opcionales

Estos no se persisten todavía (se pasan solo al prompt). Si el usuario quiere guardarlos por día, lo añadimos en una segunda iteración.

**4. Descarga .docx**
- Usar la librería ya disponible `docx` en cliente (la misma que usa `LibretoExport.tsx`) para empaquetar el texto plano del libreto en un `.docx` con encabezado y estructura básica de párrafos. No requiere reformatear: el modelo ya devuelve texto estructurado.

### Archivos

| Archivo | Cambio |
|---|---|
| `supabase/functions/generate-libreto/index.ts` (nuevo) | Edge function: lee invitados del día, construye prompt con plantilla por día, llama a Gemini 2.5 Pro |
| `src/components/DayView.tsx` | Botón "Generar libreto IA" + Dialog con resultado + copiar/descargar |
| `src/components/LibretoAIDialog.tsx` (nuevo) | Modal con mini-form (periodista, lanzamiento), llamada a la función, render del libreto, copiar y export .docx |

### No incluye
- Persistir el libreto generado en BD (queda en memoria del modal). Si quieres guardarlo por día, lo añadimos como segunda fase con una tabla `libretos_generados`.
- Editor enriquecido del libreto generado (sale como texto plano editable en `<Textarea>`).
- Base de datos de canciones en vivo / canciones 90s estructurada: si no la tienes en una tabla, el modelo escribirá `cortinilla BBB` o pedirá los datos como indica tu prompt.


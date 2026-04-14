

## Plan: Quitar día repetido en vista DÍA + Chat inteligente en búsqueda

### Parte 1: Quitar encabezado de día repetido

**Problema:** En la vista DÍA, debajo de los botones Lunes/Martes/Miércoles/Jueves aparece un encabezado grande con el día repetido (ej: "Lunes 14"), pero arriba en el FilterBar ya se muestra la fecha completa.

**Cambio:** Eliminar el bloque del "Day Header" en `src/components/DayView.tsx` (líneas 164-169).

---

### Parte 2: Chat inteligente en la búsqueda

**Objetivo:** Convertir la barra de búsqueda en un sistema dual: búsqueda tradicional + chat con IA que puede responder preguntas naturales como "¿hace cuánto vino Fulano?" o "¿quién fue el último invitado propuesto?".

**Arquitectura:**

1. **Edge Function `chat-guests`** — Recibe la pregunta del usuario, consulta la base de datos de invitados para obtener contexto relevante, y envía todo a Lovable AI (Gemini Flash) para generar una respuesta en lenguaje natural.

2. **Detección automática** — Si el texto parece una pregunta (empieza con "¿", "cuándo", "hace cuánto", "quién", "cuántos", etc.), se activa el modo chat. Si no, funciona como búsqueda normal.

3. **UI en el dropdown de búsqueda** — Se agrega una sección "Respuesta IA" arriba de los resultados normales, con un icono de sparkles y la respuesta del modelo.

**Flujo:**
```text
Usuario escribe pregunta → Detecta modo chat → 
Edge Function consulta BD (últimas apariciones, fechas, etc.) →
Envía contexto + pregunta a Lovable AI →
Muestra respuesta en el dropdown
```

**Archivos a crear/modificar:**

| Archivo | Acción |
|---------|--------|
| `src/components/DayView.tsx` | Eliminar líneas 164-169 |
| `supabase/functions/chat-guests/index.ts` | **Crear** — Edge function que consulta BD y llama a Lovable AI |
| `src/components/FilterBar.tsx` | Agregar detección de preguntas, llamada al chat, y sección de respuesta IA en el dropdown |

**Edge Function `chat-guests`:**
- Recibe `{ question: string }`
- Busca en la tabla `guests` registros relevantes (por nombre, tema, fechas)
- Construye un prompt con el contexto de la BD
- Llama a Lovable AI Gateway con el contexto
- Retorna la respuesta en texto

**Detección de preguntas (heurística):**
- Empieza con signos de interrogación o palabras clave: "cuándo", "hace cuánto", "quién", "cuántos", "último", "primera vez", "alguna vez"
- Si se detecta pregunta, se muestra un botón "Preguntar a la IA" o se activa automáticamente

**Ejemplo de interacción:**
- Usuario escribe: "hace cuánto vino Carlos Vives?"
- La IA responde: "Carlos Vives fue invitado el martes 8 de octubre de 2024, hace aproximadamente 6 meses. Tema: Lanzamiento nuevo álbum."


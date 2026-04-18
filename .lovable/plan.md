

## Plan: Libreto para Lunes y Miércoles

### Contexto

Hoy `LibretoView` solo se renderiza para Martes y Jueves (`isTuesdayOrThursday`). El usuario quiere replicar el mismo libreto para Lunes y Miércoles, **sin** el bloque fijo de "Puerta al Universo / Germán Puerta" (que es exclusivo del martes).

### Estructura por día (referencia)

| Día | H2 fija | Texto introductorio |
|---|---|---|
| Martes | Puerta al Universo (Germán Puerta) | Sí (texto fijo "Todas las noches de los martes...") |
| Jueves | #TBT | Sí (contexto editable + "Jueves de TBT...") |
| **Lunes** (nuevo) | Libre | Sin texto fijo |
| **Miércoles** (nuevo) | Libre | Sin texto fijo |

### Cambios

**1. `src/components/LibretoView.tsx`**

- Quitar el guard `if (!isTuesdayOrThursday) return null;` → permitir Lun/Mar/Mié/Jue.
- Reemplazar `isTuesday` (boolean) por una clasificación más explícita:
  - `isTuesday` → mantiene bloque Germán Puerta + numeración con canciones (martes original).
  - `isThursday` → mantiene bloque #TBT (jueves original).
  - `isMondayOrWednesday` (nuevo) → usa el **mismo molde que jueves** (numeración con clips/segmentos genéricos) **pero sin** la línea "Jueves de TBT" ni el campo `h2_contexto` específico de #TBT. En su lugar, H2 muestra solo:
    - "Tema:" → `topic` editable
    - "Contexto:" → campo libre editable (reutilizamos `h2_contexto` como campo genérico de contexto de la 2ª hora; ya existe en el schema).
- Encabezado del día (`DAYS_ES`): añadir `monday: "LUNES"` y `wednesday: "MIÉRCOLES"`.
- Título de la sección H2: 
  - Martes → "— Puerta al Universo"
  - Jueves → "— #TBT"
  - Lun/Mié → sin sufijo (solo "Segunda Hora, en vivo").
- Bloque condicional de H2:
  - Si `isTuesday` → renderiza el texto fijo de Puerta al Universo (igual que ahora).
  - Si `isThursday` → renderiza "Contexto #TBT" + "Jueves de TBT...".
  - Si `isMondayOrWednesday` → renderiza solo "Contexto:" (campo editable) + "Tema:" (sin la frase fija de "jueves para recordar").
- Numeración de segmentos: Lun/Mié usan la **misma lista** que jueves (1. Canción, 2. Avance, 3. Primer segmento, …, 10. Canción).

**2. `src/components/DayView.tsx`**

- Donde se decide mostrar `<LibretoView>` y los botones "Ver Libreto" / "Exportar Libreto" / "Imprimir Libreto", ampliar la condición de `tuesday|thursday` a `monday|tuesday|wednesday|thursday`.

**3. `src/components/LibretoExport.tsx`** (Word export)

- Replicar la misma lógica: permitir export para Lun/Mié usando el molde de jueves sin la sección Germán Puerta. Igual tratamiento de `h2_contexto` como contexto genérico.

### Lo que NO cambia

- Schema de BD (reutilizamos campos existentes: `h2_contexto`, `topic`, etc.).
- Lógica de impresión, colapsables, edición inline, encuesta, avances H2/H3.
- Endpoint `get-libreto` (ya soporta cualquier día Lun–Jue).

### Archivos

| Archivo | Cambio |
|---|---|
| `src/components/LibretoView.tsx` | Soportar Lun/Mié con molde de jueves sin bloque Germán Puerta ni frase #TBT |
| `src/components/DayView.tsx` | Habilitar libreto y botones para Lun/Mié |
| `src/components/LibretoExport.tsx` | Mismo molde en Word para Lun/Mié |


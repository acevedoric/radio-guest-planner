

## Plan: Reemplazar "Generar libreto IA" por campos editables al final de H1 y H2

Entendido: NO se requiere IA. Simplemente añadir campos editables al final de los bloques de **Hora 1** y **Hora 2** del libreto para que el productor los rellene a mano. La encuesta se captura UNA sola vez (ya existe `encuesta_pregunta` / `encuesta_hashtag` en el invitado de H1) y se muestra también en H2 como solo-lectura/eco.

### Cambios

**1. Eliminar el botón "Generar libreto IA" de `DayView.tsx`**
- Quitar el botón Sparkles, el import, el estado `libretoOpen` y el componente `<LibretoAIDialog>`.
- Borrar `src/components/LibretoAIDialog.tsx` y la edge function `supabase/functions/generate-libreto/index.ts` (no se usan).

**2. Nuevos campos en `guests` (migración)**
Añadir a la tabla `guests` (se guardan en la fila del invitado de la hora correspondiente):

- `h1_periodista_voces_sonidos text` — nombre del periodista de Voces y Sonidos
- `h1_lanzamiento_musical text` — artista + canción del cierre musical
- `h2_periodista_voces_sonidos text` — opcional, normalmente repetirá H1
- `h2_lanzamiento_musical text` — opcional

Ya existen `encuesta_pregunta` y `encuesta_hashtag` en el invitado de H1, así que la encuesta NO se duplica: se introduce en H1 y en H2 se muestra como referencia (solo lectura).

**3. Tipos (`src/types/guest.ts`)**
Añadir las 4 propiedades opcionales nuevas.

**4. `LibretoView.tsx`**
- Al final del bloque **HORA 1**, antes de "Notas adicionales", añadir un sub-bloque **"DATOS DE CIERRE / PRODUCCIÓN"** con dos `InlineField` editables:
  - "Periodista Voces y Sonidos" → `h1_periodista_voces_sonidos`
  - "Lanzamiento musical (artista — canción)" → `h1_lanzamiento_musical`
- Al final del bloque **HORA 2**, añadir el mismo sub-bloque pero:
  - Mostrar (solo lectura, en gris suave) la **encuesta** que viene de H1 (`encuesta_pregunta` + `encuesta_hashtag`) con el texto "Encuesta del día (definida en H1)".
  - Mostrar (solo lectura) el periodista y lanzamiento de H1 con etiqueta "Tomado de H1" Y permitir sobrescribir con `h2_periodista_voces_sonidos` / `h2_lanzamiento_musical` si el usuario quiere algo distinto. Si esos campos están vacíos → se muestra el de H1.
- Sin cambios en HORA 3.

**5. Export Word (`LibretoExport.tsx`)**
Incluir los nuevos campos al final de cada hora correspondiente para que aparezcan en el `.docx` exportado.

### Archivos

| Archivo | Cambio |
|---|---|
| Migración SQL | + 4 columnas opcionales en `guests` |
| `src/types/guest.ts` | + 4 propiedades opcionales |
| `src/components/DayView.tsx` | Quitar botón "Generar libreto IA" y dialog asociado |
| `src/components/LibretoView.tsx` | Sub-bloque editable al final de H1 y H2 con periodista + lanzamiento; eco de encuesta H1 en H2 |
| `src/components/LibretoExport.tsx` | Incluir nuevos campos en la exportación Word |
| `src/components/LibretoAIDialog.tsx` | Eliminado |
| `supabase/functions/generate-libreto/index.ts` | Eliminado |

### No incluye
- Llamadas a IA (descartado).
- Duplicar encuesta en H2 (queda como eco solo-lectura de H1).




## Plan: Mejorar búsqueda IA + botón X para limpiar

### Cambios

**1. Edge Function `chat-guests` — Incluir `position` en búsqueda y contexto**

- Agregar `position` al filtro `.or()` para que busque también por cargo: `position.ilike.%${sanitized}%`
- Incluir `position` en el select de `recentGuests`
- Ya se incluye `position` en el contexto enviado a la IA (línea con `g.position`), así que solo falta buscarlo

**2. Edge Function `chat-guests` — Búsqueda sin distinción de género**

- Para cada keyword, generar variantes de género automáticamente: si termina en "or" agregar variante "ora", si termina en "ora" agregar "or", si termina en "ero" agregar "era", etc.
- Alternativamente (más simple y robusto): truncar las últimas 1-2 letras de palabras que podrían tener variante de género y buscar con el tronco. Ejemplo: "escritor" → buscar `%escritor%` que ya matchea "escritora"
- Dado que `ilike` con `%escritor%` ya incluye "escritora" (porque "escritora" contiene "escritor"), esto funciona naturalmente para la mayoría de casos. El problema sería al revés: "escritora" no matchea "escritor". Solución: agregar al prompt de la IA instrucciones de ignorar género, y en la búsqueda DB, si la palabra termina en "a"/"o", buscar también con la otra terminación.

**3. FilterBar — Botón X para limpiar búsqueda**

- Agregar un ícono `X` al final del input cuando `searchQuery` no está vacío
- Al hacer click, llama `onSearchChange("")` para limpiar todo
- Importar `X` de lucide-react

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/chat-guests/index.ts` | Agregar `position` al `.or()` filter; generar variantes de género para keywords |
| `src/components/FilterBar.tsx` | Agregar botón X para limpiar el campo de búsqueda |


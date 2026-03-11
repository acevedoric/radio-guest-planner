

## Mejorar el renderizado de markdown en los módulos de información

**Diagnóstico**: Ya existe una función `renderBoldMarkdown` que convierte `**texto**` a negrilla, pero solo maneja ese caso. No soporta `##` (encabezados), `*italic*`, ni combinaciones. Si n8n envía markdown más complejo, se muestra el texto crudo.

**Esto se puede corregir aquí en el código**, no es necesario cambiar nada en n8n. Solo hay que ampliar la función de renderizado para soportar más sintaxis markdown.

### Cambio

Reemplazar `renderBoldMarkdown` por una función `renderMarkdown` más completa que soporte:

| Sintaxis | Resultado |
|----------|-----------|
| `**texto**` | **Negrilla** |
| `*texto*` | *Itálica* |
| `## Título` | Encabezado (texto grande/negrilla) |
| `### Subtítulo` | Subtítulo (negrilla, tamaño menor) |
| `- item` | Lista con viñeta |

La función procesará el texto línea por línea: detecta encabezados (`##`, `###`) y listas (`-`), y dentro de cada línea aplica negrilla e itálica con regex.

### Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/GuestInfoModules.tsx` | Reemplazar `renderBoldMarkdown` por `renderMarkdown` con soporte completo |


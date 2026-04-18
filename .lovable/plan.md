

## Plan: Ajustes libreto Lunes y Miércoles

Aplicar solo cuando `isMonOrWed === true`. No afecta martes/jueves.

### H1 — Cambiar "Clip COMEDIANTE" por "Canción"

En `LibretoView.tsx` (líneas 228, 241, 250, 261, 269, 271, 276, 278), la condición actual es `isTuesday ? "Canción" : "Clip COMEDIANTE"`. Cambiarla a `(isTuesday || isMonOrWed) ? "Canción" : "Clip COMEDIANTE"` para que Lun/Mié usen la **misma numeración con canciones que el martes** (1. Canción, 4. Canción, 7. Canción, 10. Canción), eliminando los "Clip 1/2/3/4 COMEDIANTE" y la línea suelta de jueves.

Etiquetas auxiliares ("Canciones en stock" / "Clips de comediante" en el bloque de stock) → usar "Canciones en stock" para Lun/Mié.

### H2 — Garantizar bloque de Información Personal y Preguntas Sugeridas

Hoy `h2_info_personal` y `h2_preguntas_sugeridas` solo se renderizan si tienen contenido (`if (h2?.h2_info_personal && …)`). Para Lun/Mié (y por consistencia también martes/jueves) cambiar la condición a `(value || editMode)` igual que ya se hace en H3, mostrando siempre el bloque editable con etiqueta:

- **"Información personal:"** → campo `h2_info_personal`
- **"Preguntas sugeridas según el tema a tratar:"** → campo `h2_preguntas_sugeridas`

Las 4 canciones de H2 ya están presentes en el bloque de jueves/Lun/Mié (líneas 365–367), no se tocan.

### H3 — Mostrar redes sociales del invitado + secciones existentes

Actualmente H3 no imprime redes del invitado de la 3ra hora. Añadir tras la línea de "Tema:" (después de línea 413):

```
X: <twitter h3>
IG: <instagram h3>
```

usando el helper `getSocial(h3, …)` igual que se hace en H1/H2 (mostrar "—" si no hay).

Las secciones **DATOS PERSONALES** (`h3_datos_personales`) y **COMUNICADO DE PRENSA** (`h3_comunicado_prensa`) ya existen (líneas 415–433); no se modifican. Se mantienen visibles en `editMode` o cuando tienen contenido, lo que aplica para todos los días incluyendo Lun/Mié.

### Archivo único modificado

| Archivo | Cambio |
|---|---|
| `src/components/LibretoView.tsx` | H1: `isTuesday \|\| isMonOrWed` para usar canciones. H2: bloque info personal y preguntas sugeridas siempre visibles (valor o editMode). H3: añadir líneas X / IG con `getSocial(h3, …)` |

### No se toca

- `LibretoExport.tsx` (Word) — si quieres que el export Word refleje los mismos cambios, dímelo y lo añado en una segunda pasada.
- Schema de BD, martes, jueves (mantienen su lógica actual).


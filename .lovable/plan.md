

## Plan: Fase 1 — Libreto para Martes y Jueves

### Resumen

Agregar las secciones faltantes del libreto diario para los días **Martes** y **Jueves**, basados en los moldes Word. La Vista Día detectará el día seleccionado y mostrará secciones específicas según corresponda.

### Estructura del Libreto (según los moldes)

**Elementos comunes a ambos días:**
- **Canciones en stock**: texto libre por hora para listar canciones sugeridas y criterios de selección
- **Encuesta del día**: pregunta + hashtag (entre Hora 1 y Hora 2)
- **Avance segunda hora**: texto de transición que conecta H1 con H2
- **Avance tercera hora**: texto de transición que conecta H2 con H3

**Martes específico:**
- H2: Sección fija "Puerta al Universo" con contexto astronómico
- Hashtag: `#PuertaAlUniversoBlaBlaBLU`

**Jueves específico:**
- H1: usa "Clips de comediante" en lugar de canciones
- H2: Sección fija "#TBT" con contexto de recuerdo/nostalgia
- Hashtag: `#tbtBlaBlaBLU`

### Cambios en base de datos

Nuevas columnas en la tabla `guests` (se anclan al invitado de Hora 1 como dato del día):

```sql
-- Encuesta del día
ALTER TABLE guests ADD COLUMN encuesta_pregunta text;
ALTER TABLE guests ADD COLUMN encuesta_hashtag text;

-- Canciones / Clips por hora
ALTER TABLE guests ADD COLUMN h1_canciones text;
ALTER TABLE guests ADD COLUMN h2_canciones text;
ALTER TABLE guests ADD COLUMN h3_canciones text;

-- Contexto de la segunda hora (intro del segmento)
ALTER TABLE guests ADD COLUMN h2_contexto text;

-- Avances (transiciones entre horas)
ALTER TABLE guests ADD COLUMN avance_h2 text;
ALTER TABLE guests ADD COLUMN avance_h3 text;
```

**Total: 8 columnas nuevas.**

### Cambios en código

**1. `src/types/guest.ts`** — Agregar los 8 campos nuevos.

**2. `src/components/DayView.tsx`** — Agregar secciones condicionales por día:

- **Sección "Canciones"** (icono 🎵): Textarea editable dentro de cada Card de hora. En Jueves H1 se etiqueta como "Clips de comediante" en lugar de "Canciones".

- **Sección "Encuesta del día"** (icono 📊): Card independiente entre Hora 1 y Hora 2. Muestra pregunta editable + campo de hashtag. Solo aparece si `selectedDay === 'tuesday' || selectedDay === 'thursday'`. Se guarda en el guest de Hora 1.

- **Sección "Contexto H2"** (icono 📝): Textarea dentro de la Card de Hora 2. Para Martes muestra placeholder "Puerta al Universo..."; para Jueves placeholder "#TBT...". Se guarda en el guest de Hora 2.

- **Sección "Avance"** (icono 📢): Textarea al final de Hora 1 (avance H2) y al final de Hora 2 (avance H3). Texto de transición entre segmentos.

**3. Lógica de guardado**: Cada campo nuevo usa el mismo patrón que los checkboxes existentes — `supabase.update()` directo con `onBlur`.

### Lo que NO incluye esta fase

- Lunes y Miércoles (se harán después con sus moldes)
- Generación con IA de canciones/encuestas
- Exportar a Word
- Conteo de seguidores de redes sociales

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | 8 nuevas columnas |
| `src/types/guest.ts` | Nuevos campos |
| `src/components/DayView.tsx` | Secciones de Canciones, Encuesta, Contexto H2, Avances |


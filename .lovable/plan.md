

## Plan: Módulos de información para Hora 2 y Hora 3

### Resumen

Agregar módulos colapsables con información, carga de archivos, campo de enlace externo y generación con IA para los invitados de la 2da y 3ra hora, similar a lo que existe para la 1ra hora.

### Estructura de módulos

**Hora 2 (2 casillas):**
- 📋 INFORMACIÓN PERSONAL — datos personales del invitado
- ❓ PREGUNTAS SUGERIDAS — preguntas basadas en el tema a tratar

**Hora 3 (2 casillas):**
- 📋 DATOS PERSONALES — información del invitado
- 📰 COMUNICADO DE PRENSA — datos del comunicado de prensa

Cada módulo tendrá: texto editable (markdown), carga de archivo (PDF/Word), campo de enlace externo, y botón de generación con IA.

### Cambios en base de datos

Migración para agregar 12 nuevas columnas a la tabla `guests`:

```sql
-- Hora 2
ALTER TABLE guests ADD COLUMN h2_info_personal text;
ALTER TABLE guests ADD COLUMN h2_preguntas_sugeridas text;
ALTER TABLE guests ADD COLUMN h2_documento_url text;
ALTER TABLE guests ADD COLUMN h2_documento_nombre text;
ALTER TABLE guests ADD COLUMN h2_link_info text;

-- Hora 3
ALTER TABLE guests ADD COLUMN h3_datos_personales text;
ALTER TABLE guests ADD COLUMN h3_comunicado_prensa text;
ALTER TABLE guests ADD COLUMN h3_documento_url text;
ALTER TABLE guests ADD COLUMN h3_documento_nombre text;
ALTER TABLE guests ADD COLUMN h3_link_info text;

-- AI timestamp per slot
ALTER TABLE guests ADD COLUMN h2_n8n_updated_at timestamptz;
ALTER TABLE guests ADD COLUMN h3_n8n_updated_at timestamptz;
```

### Cambios en código

**1. `src/types/guest.ts`** — Agregar los 12 nuevos campos al tipo Guest.

**2. `src/components/GuestInfoModules.tsx`** — Refactorizar para aceptar un prop `slot` que determine qué módulos mostrar:
- `slot === 1`: módulos actuales (sin cambios)
- `slot === 2`: INFORMACIÓN PERSONAL + PREGUNTAS SUGERIDAS
- `slot === 3`: DATOS PERSONALES + COMUNICADO DE PRENSA

Agregar a cada módulo:
- Campo de enlace externo (input de URL) debajo del contenido de texto
- Carga de archivo (PDF/Word) — reutilizar la lógica existente de `tema_principal` pero parametrizada por `documento_url_key` y `documento_nombre_key`
- Botón IA — reutilizar `handleTriggerAI` pasando el slot

**3. `src/components/DayView.tsx`** — Renderizar `<GuestInfoModules>` también para slots 2 y 3:
```tsx
{slot === 2 && <GuestInfoModules guest={guest} editMode={editMode} slot={2} onGuestUpdate={...} />}
{slot === 3 && <GuestInfoModules guest={guest} editMode={editMode} slot={3} onGuestUpdate={...} />}
```

**4. `supabase/functions/trigger-n8n-scraping/index.ts`** — Modificar para aceptar el parámetro `slot` y adaptar el prompt/campos según la hora.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Migración SQL | 12 nuevas columnas en `guests` |
| `src/types/guest.ts` | Nuevos campos en la interfaz |
| `src/components/GuestInfoModules.tsx` | Prop `slot`, módulos dinámicos, campo de enlace, documento parametrizado |
| `src/components/DayView.tsx` | Renderizar módulos para slots 2 y 3 |
| `supabase/functions/trigger-n8n-scraping/index.ts` | Soporte para slot 2 y 3 en scraping IA |


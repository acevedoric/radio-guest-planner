

## Plan: Libreto del Día — Vista Interactiva en Línea

### Resumen

Crear un componente `LibretoView` que renderice el guión completo del programa directamente en la Vista Día (solo Martes/Jueves), con campos dinámicos que se rellenan automáticamente desde los datos del planner, campos pendientes resaltados en amarillo, edición inline, secciones colapsables por hora, y botón de impresión.

### Lo que ya existe y se reutiliza

- `LibretoExport.tsx` — Tiene las plantillas completas de Martes y Jueves. La misma estructura se replica en HTML.
- `LibretoSections.tsx` — `LibretoField` ya maneja edición inline con auto-save en `onBlur`. Se reutiliza.
- `n8n-guest-info` edge function — Ya acepta POST con datos del invitado y actualiza la BD. Sirve como webhook para n8n.

### Cambios

**1. Nuevo componente `src/components/LibretoView.tsx`**

Componente principal que renderiza el libreto completo en HTML:

- Recibe `guests`, `selectedDay`, `selectedDayDate`, `editMode`
- Solo se muestra para Martes y Jueves
- Estructura: plantilla hardcodeada (misma que en LibretoExport) pero en JSX
- **Campos dinámicos**: texto entre `[corchetes]` se reemplaza por datos del guest:
  - Si el dato existe → texto normal integrado
  - Si el dato NO existe → `<span>` con fondo amarillo/naranja, icono de advertencia, clickeable para editar inline
- **Edición inline**: al hacer clic en cualquier campo (lleno o pendiente), se convierte en input/textarea. Al hacer blur, se guarda via Supabase y se sincroniza con `onGuestUpdate`
- **Secciones colapsables**: cada hora es un `Collapsible` (ya existe el componente) con trigger que muestra "PRIMERA HORA", "SEGUNDA HORA", "TERCERA HORA"
- **Fuente legible**: texto base de 16px, fondo ligeramente diferenciado (`bg-amber-50/50` o similar)
- **Botón "Imprimir libreto"**: genera `window.print()` con CSS `@media print` que oculta controles de edición y muestra solo el texto limpio

**2. Modificar `src/components/DayView.tsx`**

- Agregar `<LibretoView>` después de TITULARES y antes de las Cards de slots (solo Mar/Jue)
- El LibretoView reemplaza visualmente las secciones individuales de LibretoSections cuando está visible (toggle opcional, o siempre visible)

**3. n8n Integration (ya existente)**

- El endpoint `n8n-guest-info` ya funciona como webhook POST
- Documentar en comentarios del código los campos esperados para facilitar integración
- Agregar un endpoint GET simple (nueva edge function `get-libreto`) que devuelva el libreto de un día en JSON

**4. Nueva edge function `supabase/functions/get-libreto/index.ts`**

- GET con query param `date=YYYY-MM-DD`
- Devuelve JSON con los 3 invitados del día y todos sus campos del libreto
- Protegido por `x-webhook-secret`

### Mapeo de campos (resumen)

| Placeholder | Guest field | Slot |
|---|---|---|
| `[INVITADO]` | `name` | H1 |
| `[Cargo]` | `position` | H1 |
| `[twitter]`/`[instagram]` | `social_networks` | H1/H2/H3 |
| `[TEMA PRINCIPAL]` | `tema_principal` | H1 |
| `[INFANCIA Y VIDA PRIVADA]` | `infancia_vida_privada` | H1 |
| `[CARRERA]` | `carrera_profesional` | H1 |
| `[DATOS CURIOSOS]` | `datos_curiosos` | H1 |
| `[PREGUNTA DE LA ENCUESTA]` | `encuesta_pregunta` | H1 |
| `[TEMA SEGUNDA HORA]` | `topic` | H2 |
| `[INVITADO SEGUNDA HORA]` | `name` | H2 |
| `[INVITADO TERCERA HORA]` | `name` | H3 |
| `[TEMA TERCERA HORA]` | `topic` | H3 |
| `[DIA]`, `[MES]`, `[AÑO]` | Desde `selectedDayDate` | — |

### Archivos a crear/modificar

| Archivo | Cambio |
|---|---|
| `src/components/LibretoView.tsx` | **Nuevo** — Vista interactiva del libreto completo |
| `src/components/DayView.tsx` | Integrar `<LibretoView>` para Mar/Jue |
| `supabase/functions/get-libreto/index.ts` | **Nuevo** — GET endpoint para n8n |
| `supabase/config.toml` | Agregar config para `get-libreto` |

### Lo que NO incluye

- Lunes/Miércoles (se harán con sus propios moldes)
- Campo `[nombre del periodista]` configurable (se puede agregar después como setting)
- Conteo de seguidores de redes sociales


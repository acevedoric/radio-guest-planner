

The user wants the ability to add **extra/additional notes** at the end of each script section (H1, H2, H3) via a pencil icon on the right side, in addition to the existing inline editing.

Looking at `LibretoView.tsx`, each `HourSection` already supports inline editing of structured fields. We need a **free-form notes block** per hour, editable via a dedicated pencil button.

## Plan

### 1. New DB columns (migration)

Add three optional text columns to `guests`:
- `h1_notas_adicionales text`
- `h2_notas_adicionales text`
- `h3_notas_adicionales text`

(Stored on the H1/H2/H3 guest row respectively, matching the existing pattern of `h1_canciones`, `h2_canciones`, etc.)

### 2. Update `src/types/guest.ts`

Add the three optional fields to the `Guest` interface.

### 3. Update `src/components/LibretoView.tsx`

- Add a pencil button (`Pencil` icon from lucide-react) to the right side of each `HourSection` trigger header, visible only when `editMode` is true.
- Clicking the pencil:
  - Stops propagation (doesn't toggle the collapsible).
  - Opens the section if closed and focuses a new "NOTAS ADICIONALES" block at the bottom.
- At the end of each section's content, render a **"Notas adicionales"** block:
  - Always visible if it has content; in `editMode` always visible (even if empty) with placeholder.
  - Uses the existing `InlineField` component (multiline) bound to `h1_notas_adicionales` / `h2_notas_adicionales` / `h3_notas_adicionales` on the corresponding hour's guest row.
  - Styled distinctively (e.g., dashed border + muted background) so it reads as "extra info" not part of the canonical script.
- Header layout change: wrap trigger title + pencil in a flex row; pencil is `print:hidden`.

### 4. (Optional) Word export

`LibretoExport.tsx` not modified in this step. Mention it as a follow-up if user wants the notes in the printed/Word output.

### Files

| Archivo | Cambio |
|---|---|
| Migración SQL (nueva) | Añadir `h1_notas_adicionales`, `h2_notas_adicionales`, `h3_notas_adicionales` a `guests` |
| `src/types/guest.ts` | Añadir las 3 propiedades opcionales |
| `src/components/LibretoView.tsx` | Botón lápiz por sección (solo edit mode) + bloque "Notas adicionales" editable al final de H1/H2/H3 |

### No incluye

- Export Word (`LibretoExport.tsx`) — pregúntame si quieres reflejar las notas también allí.
- Notas por sub-segmento (solo una por hora, al final). Si quieres notas por cada bloque (Infancia, Carrera, etc.), dímelo y lo amplío.


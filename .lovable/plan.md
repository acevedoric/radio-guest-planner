

## Plan: Imprimir libreto como pantallazo limpio (sin botones)

### Cambios

**1. `src/components/LibretoView.tsx`**
- Cambiar `handlePrint`: en vez de generar Word, llamar a `window.print()`.
- Antes de imprimir, expandir las 3 `HourSection` (forzar `open=true`) para que todo el contenido sea visible.
- Quitar la importación de `generateLibretoBlob` y `saveAs` (ya no se usan aquí).

**2. `src/index.css`**
- Reforzar reglas `@media print`:
  - `body * { visibility: hidden; }` y `.libreto-view, .libreto-view * { visibility: visible; }` para mostrar SOLO el libreto.
  - Posicionar `.libreto-view` en `position: absolute; top: 0; left: 0; width: 100%;`.
  - Ocultar header de la app, sidebar, botones de día, botones "Ver Libreto"/"Exportar Libreto"/"Imprimir Libreto" con `.print:hidden` y selectores específicos.
  - Forzar que los `CollapsibleContent` se muestren expandidos en print (`[data-state="closed"] { display: block !important; }` dentro de `.libreto-view`).
  - Quitar fondos de color, usar texto negro sobre blanco para ahorrar tinta.

### Resultado
Al pulsar "Imprimir Libreto" → diálogo nativo de impresión del navegador → solo se ve el contenido del libreto a pantalla completa, sin headers, sidebars ni botones. El botón "Exportar Libreto" sigue generando el Word como hasta ahora.

### Archivos

| Archivo | Cambio |
|---|---|
| `src/components/LibretoView.tsx` | `handlePrint` usa `window.print()` + expande secciones |
| `src/index.css` | Reglas `@media print` más estrictas |


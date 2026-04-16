

## Plan: Reorganizar Vista Día — Titulares arriba, Libreto colapsable, botón "Ver Libreto"

### Resumen

Reorganizar la Vista Día para que TITULARES aparezca primero, seguido del LibretoView colapsado por defecto. Mover los botones "Exportar Libreto" y un nuevo "Ver Libreto" al lado de los selectores de día. El botón "Imprimir Libreto" pasa a generar y descargar/imprimir el documento Word en vez de hacer `window.print()`.

### Cambios

**1. `src/components/DayView.tsx`**

- Mover la Card de TITULARES arriba de todo (después del selector de días)
- Mover `LibretoExport` y nuevo botón "Ver Libreto" a la misma fila que los botones de día (al lado derecho)
- "Ver Libreto" togglea un estado `showLibreto` que muestra/oculta el `<LibretoView>` (colapsado por defecto)
- Pasar las secciones individuales de `LibretoSections` (Encuesta, Canciones, etc.) a mostrarse solo cuando el libreto NO está visible, para evitar duplicación

**2. `src/components/LibretoView.tsx`**

- Las 3 `HourSection` inician colapsadas (`defaultOpen={false}`)
- El botón "Imprimir Libreto" cambia su lógica: en vez de `window.print()`, genera el .docx usando la misma lógica de `LibretoExport` y lo abre para impresión (genera blob → descarga)
- Importar las funciones de generación desde `LibretoExport` (extraer `buildTuesdayDoc`, `buildThursdayDoc`, `buildDateInfo` como exports)

**3. `src/components/LibretoExport.tsx`**

- Exportar las funciones `buildTuesdayDoc`, `buildThursdayDoc`, `buildDateInfo` para reutilizarlas desde LibretoView

### Orden visual resultante

```text
┌─────────────────────────────────────────────┐
│  [Lunes] [Martes] [Miércoles] [Jueves]      │
│                    [Ver Libreto] [Exportar]  │
├─────────────────────────────────────────────┤
│  📰 TITULARES                                │
│    1ra hora: Nombre — Tema                   │
│    2da hora: Nombre — Tema                   │
│    3ra hora: Nombre — Tema                   │
├─────────────────────────────────────────────┤
│  (si Ver Libreto activo)                     │
│  📋 LIBRETO DEL DÍA  [Imprimir]             │
│  ▶ 1. Primera Hora (colapsado)              │
│  ▶ 2. Segunda Hora (colapsado)              │
│  ▶ 3. Tercera Hora (colapsado)              │
├─────────────────────────────────────────────┤
│  Cards de invitados (Hora 1, 2, 3)          │
└─────────────────────────────────────────────┘
```

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/DayView.tsx` | Reordenar secciones, agregar toggle "Ver Libreto", mover botones |
| `src/components/LibretoView.tsx` | Secciones colapsadas por defecto, imprimir genera Word |
| `src/components/LibretoExport.tsx` | Exportar funciones de generación para reutilizar |


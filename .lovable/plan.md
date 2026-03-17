

## Plan: Agregar correo de prensa y registro de quién propone

### Cambios necesarios

**1. Migración de base de datos**
- Agregar columna `press_email` (text, nullable) a la tabla `guests` para almacenar el correo del contacto de prensa/manager.
- Agregar columna `proposed_by` (text, nullable) a la tabla `guests` para registrar quién hizo la propuesta (nombre o email del usuario logueado).

**2. Tipo Guest (`src/types/guest.ts`)**
- Agregar `press_email?: string | null` y `proposed_by?: string | null`.

**3. Modal de detalle (`src/components/GuestDetailModal.tsx`)**
- En la sección de Contacto de Prensa, reorganizar para poner nombre, teléfono y correo en una fila. Agregar campo `press_email` con placeholder de email, con enlace clickeable `mailto:` en modo lectura.
- Al guardar un nuevo invitado (sin `id`), registrar automáticamente el usuario logueado en `proposed_by`.

**4. Vistas de calendario (WeeklyCalendar, MonthView, DayView)**
- Junto a los checkboxes de confirmación (CONF. BLU / CONF. PR), mostrar quién propuso el invitado (`proposed_by`) como texto pequeño.
- En la sección de "Contactar PR" del DayView, incluir botón de email si `press_email` existe.

**5. Búsqueda (`Index.tsx`, `SearchResults.tsx`, `FilterBar.tsx`)**
- Incluir `press_email` en los filtros de búsqueda de prensa existentes.


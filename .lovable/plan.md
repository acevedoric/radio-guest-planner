## Plan: Acceso público de solo lectura con botón "Login"

Permitir que cualquier visitante (sin autenticar) entre directamente a la app y vea el calendario en modo lectura. La autenticación deja de ser obligatoria; sólo se exige para editar. En el header, donde hoy aparece "Salir", aparecerá "Login" cuando no haya sesión.

### Comportamiento

**Sin sesión (público):**
- Entra directo a `/` (ya no redirige a `/auth`).
- Ve Día / Semana / Mes / Propuestos en modo presentación (readonly).
- No puede activar Edit mode, ni arrastrar, ni abrir modales de edición, ni marcar checkboxes, ni crear/borrar invitados, ni usar undo/redo.
- El header muestra botón **"Login"** (icono `LogIn`) que va a `/auth`.
- Toggle "Presentar" queda fijo en ON y oculto/deshabilitado.

**Con sesión válida (`@caracoltv.com.co` o allowlist):**
- Funciona exactamente igual que hoy. Header muestra "Salir".

**Con sesión pero email no permitido:**
- Sigue mostrando `AccessDenied` como hoy.

### Cambios técnicos

| Archivo | Cambio |
|---|---|
| `src/components/AuthGuard.tsx` | Si no hay sesión → renderiza children con `readOnly=true` vía contexto, sin redirigir. Si hay sesión y email permitido → `readOnly=false`. Si sesión pero no permitido → `AccessDenied`. |
| `src/contexts/ReadOnlyContext.tsx` (nuevo) | Provider + hook `useReadOnly()` que expone `isReadOnly: boolean`. |
| `src/pages/Index.tsx` | Lee `useReadOnly()`. Si readonly: fuerza `editMode=false`, oculta toggle de edit mode, oculta botones Undo/Redo, reemplaza botón "Salir" por "Login" → `navigate('/auth')`. Bloquea `handleSaveGuest`/`handleDeleteGuest`/`handleMoveGuest`/`handleAddGuest` con early return + toast "Inicia sesión para editar". |
| `src/components/GuestDetailModal.tsx` | Si readonly: oculta botones Guardar/Eliminar y deshabilita inputs (sólo lectura). |
| `src/components/DayView.tsx`, `WeeklyCalendar.tsx`, `MonthView.tsx`, `ProposedView.tsx` | Si readonly: desactivar drag&drop, checkboxes, botones "+", clicks de edición. Los clicks en invitado pueden seguir abriendo el modal en modo lectura. |
| `src/pages/SearchResults.tsx` | Igual: readonly oculta acciones. |
| Nueva migración SQL | `GRANT SELECT ON public.guests TO anon;` + nueva policy `CREATE POLICY "Anyone can view guests" ON public.guests FOR SELECT TO anon USING (true);`. Idem para tablas auxiliares que el calendario lee si las hay. |

### Aviso de seguridad

Conceder SELECT público a `guests` expone públicamente: nombre del invitado, tema, contacto de prensa (`press_contact`, `press_phone`, `press_email`), notas internas y módulos de información. Si quieres ocultar contacto de prensa al público, puedo hacer una **vista pública** `public_guests` que omita esos campos y conceder SELECT sólo sobre la vista — dilo y lo ajusto.

### No incluye
- Cambios al flujo de login `@caracoltv.com.co` (intacto).
- Persistencia de cambios desde modo público.
- Vista pública filtrada (opcional, ver aviso arriba).

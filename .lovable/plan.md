

## Plan: Corregir reubicación de invitados al cambiar fecha

### Diagnóstico
Revisé la base de datos y encontré el caso exacto: **Felipe Peláez** tiene `recording_status: proposed` (azul), `scheduled_date: 2026-04-15`, pero `week_date: 2026-03-23`. El invitado sigue apareciendo en la semana del 23 de marzo porque la lógica de reubicación en `handleSaveGuest` solo se activa cuando el estado es `"postponed"`, pero NO para `"proposed"` ni `"to_record"`.

### Solución
Extender la lógica de reubicación en `src/pages/Index.tsx` (`handleSaveGuest`) para que se active con **cualquier estado que muestre el campo `scheduled_date`**: `postponed`, `proposed` y `to_record`.

### Cambio en código

**`src/pages/Index.tsx`** — Línea 138, cambiar:
```typescript
// ANTES:
if (guestData.recording_status === "postponed" && guestData.scheduled_date) {

// DESPUÉS:
const statusesWithRelocation = ["postponed", "proposed", "to_record"];
if (statusesWithRelocation.includes(guestData.recording_status) && guestData.scheduled_date) {
```

El resto de la lógica (calcular nueva semana, día, verificar conflictos) permanece igual. Esto hará que al establecer una `scheduled_date` en cualquiera de esos estados, el invitado se mueva automáticamente a la fecha correcta y libere el slot original.


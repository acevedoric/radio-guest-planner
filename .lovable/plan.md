

## Diagnóstico: El modal se cierra antes de que el guardado termine

El problema está en `GuestDetailModal.tsx`, línea 109-110:

```typescript
onSave(finalData);  // NO se espera (await) — handleSaveGuest es async
onClose();          // cierra el modal INMEDIATAMENTE
```

Esto causa que:
1. Si hay un **conflicto de slot** en la fecha destino, el error toast aparece pero el modal ya se cerró — el usuario no asocia el error con su acción.
2. Si la validación de `handleSaveGuest` hace `return` (ej: "La fecha no cae en día laboral"), el modal ya se cerró y parece que "no pasó nada".
3. El usuario ve el modal cerrarse y asume que guardó, pero el invitado no se actualizó.

### Solución

**Archivo: `src/pages/Index.tsx`**
- Cambiar `handleSaveGuest` para que retorne `boolean` (`true` = éxito, `false` = error).
- Cambiar el tipo de `onSave` en el modal de `(guest: Guest) => void` a `(guest: Guest) => Promise<boolean>`.

**Archivo: `src/components/GuestDetailModal.tsx`**
- En `handleSubmit`: hacer `await onSave(finalData)` y solo llamar `onClose()` si retorna `true`.
- Si retorna `false`, el modal permanece abierto para que el usuario corrija el problema.

### Cambios concretos

1. **`Index.tsx` — `handleSaveGuest`**: Agregar `return true` tras éxito y `return false` tras cada error/return temprano.
2. **`GuestDetailModal.tsx` — tipo `onSave`**: Cambiar a `(guest: Guest) => Promise<boolean>`.
3. **`GuestDetailModal.tsx` — `handleSubmit`**: 
   ```typescript
   const success = await onSave(finalData);
   if (success) onClose();
   ```



## Problema: confirm() bloqueado en iframe

La función `handleDelete` en `GuestDetailModal.tsx` (línea 100) usa:
```
if (confirm("¿Estás seguro de eliminar este invitado?")) {
```

`window.confirm()` está **bloqueado por los navegadores modernos dentro de iframes**, por lo que siempre retorna `false` sin mostrar ningún dialogo. El usuario hace clic en "Eliminar", no pasa nada visible, y el invitado no se borra.

La autenticación también muestra un error de token expirado en los logs, pero ese no es el problema principal aquí.

## Solución

Reemplazar `confirm()` por un `AlertDialog` de Radix UI (ya instalado) que funciona correctamente dentro del iframe y en cualquier contexto.

## Detalles técnicos

**Archivo: `src/components/GuestDetailModal.tsx`**

1. Importar `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogTrigger` desde `@/components/ui/alert-dialog`.
2. Reemplazar el botón "Eliminar" con un `AlertDialog` que envuelve el trigger y muestra un diálogo de confirmación propio de React.
3. El diálogo mostrará:
   - Título: "¿Eliminar invitado?"
   - Descripción: "Esta acción no se puede deshacer. El invitado sera eliminado permanentemente de la base de datos."
   - Botón "Cancelar" y botón "Eliminar" (destructivo)

El flujo correcto quedaria:

```
Clic en "Eliminar"
  -> Se abre AlertDialog (React, funciona en iframe)
  -> Usuario confirma
  -> onDelete(guest.id) se ejecuta
  -> Supabase DELETE en la tabla guests
  -> Toast de confirmacion
  -> Modal se cierra
```

| Archivo | Cambio |
|---------|--------|
| `src/components/GuestDetailModal.tsx` | Reemplazar confirm() con AlertDialog de Radix UI |

No se requieren cambios en la base de datos ni en otros archivos. La RLS ya permite borrar a usuarios con rol admin, y `handleDeleteGuest` en `Index.tsx` ya funciona correctamente.

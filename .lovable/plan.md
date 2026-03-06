

## Correccion: El invitado no se elimina porque la politica de seguridad lo impide

### Causa raiz

La politica de eliminacion (RLS) en la tabla `guests` solo permite borrar a usuarios con rol `admin`. Tu usuario tiene rol `producer`. Cuando intentas eliminar, la base de datos no devuelve un error explicito -- simplemente no borra nada. Por eso ves el mensaje "Invitado eliminado" pero el registro sigue ahi.

### Solucion

Dos cambios:

| Cambio | Detalle |
|--------|---------|
| **Actualizar politica RLS** | Permitir que `producer` tambien pueda eliminar invitados (igual que ya puede crear y editar) |
| **Validar eliminacion en codigo** | Verificar que realmente se elimino el registro, y mostrar error si no |

### Detalle tecnico

**1. Migracion SQL:** Reemplazar la politica restrictiva de DELETE para incluir productores:

```sql
DROP POLICY "Admins can delete guests" ON public.guests;
CREATE POLICY "Producers and admins can delete guests" 
  ON public.guests FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'producer'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
```

**2. En `src/pages/Index.tsx`:** Agregar validacion post-delete usando `.select()` para confirmar que el registro fue eliminado:

```typescript
const { error, count } = await supabase
  .from('guests')
  .delete({ count: 'exact' })
  .eq('id', guestId);

if (error || count === 0) {
  toast.error("No se pudo eliminar el invitado");
} else {
  // proceder con exito...
}
```


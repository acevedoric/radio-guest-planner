

## Corregir eliminacion de invitado para que se refleje en todas las vistas

### Problema
Cuando eliminas un invitado desde el modal, `handleDeleteGuest` actualiza el estado local con `setGuests(prev => prev.filter(...))`, pero al cambiar de vista (dia → semana → mes), el efecto que depende de `viewMode` ejecuta `fetchGuests()` que deberia traer datos frescos. Sin embargo, el modal no se cierra automaticamente al eliminar, y `handleDelete` en el modal llama `onClose()` antes de que la eliminacion en la BD se complete. Ademas, no se fuerza un `fetchGuests()` despues de eliminar exitosamente.

### Solucion

Dos cambios simples:

| Archivo | Cambio |
|---------|--------|
| `src/pages/Index.tsx` | En `handleDeleteGuest`: despues de eliminar exitosamente, llamar `fetchGuests()`, cerrar el modal (`setIsModalOpen(false)`, `setSelectedGuest(null)`) |
| `src/components/GuestDetailModal.tsx` | En `handleDelete`: NO llamar `onClose()` aqui (dejar que el padre cierre el modal despues de la eliminacion) |

### Detalle

**Index.tsx - `handleDeleteGuest`:**
```typescript
const handleDeleteGuest = async (guestId: string) => {
  const { error } = await supabase.from('guests').delete().eq('id', guestId);
  if (error) {
    toast.error("Error al eliminar invitado");
  } else {
    toast.success("Invitado eliminado");
    setIsModalOpen(false);
    setSelectedGuest(null);
    setNewGuestSlot(null);
    await fetchGuests(); // Recargar datos frescos de la BD
  }
};
```

**GuestDetailModal.tsx - `handleDelete`:**
```typescript
const handleDelete = () => {
  if (guest?.id && onDelete) {
    onDelete(guest.id);
    // No llamar onClose() aqui - el padre lo maneja
  }
};
```

Esto garantiza que al eliminar, los datos se recargan desde la BD y el estado local se sincroniza correctamente para cualquier vista.


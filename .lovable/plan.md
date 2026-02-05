

## Plan: Actualizar Guest Documents a Signed URLs

### Contexto
El bucket `guest-documents` ahora es privado por seguridad. El código actual usa `getPublicUrl()` que ya no funciona. Necesitamos cambiar a **signed URLs** (URLs temporales con firma de seguridad).

### Cambios a Realizar

**Archivo: `src/components/GuestInfoModules.tsx`**

1. **Modificar `handleDocumentUpload`**
   - En lugar de guardar la URL pública completa, guardar solo el `filePath` relativo
   - Esto permite generar signed URLs dinámicamente cuando se necesiten

2. **Agregar función `getSignedUrl`**
   - Nueva función que genera una URL firmada temporal (válida por 1 hora)
   - Se llamará al hacer clic en el botón de descarga

3. **Modificar el botón de descarga**
   - Cambiar de un link directo `<a href={url}>` a un botón que:
     - Genera la signed URL al momento
     - Abre la URL en una nueva pestaña

### Resumen de Cambios

```text
┌─────────────────────────────────────────────────────────┐
│                    ANTES (Inseguro)                     │
├─────────────────────────────────────────────────────────┤
│  Subir → getPublicUrl() → Guardar URL pública           │
│  Descargar → Usar URL pública directamente              │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   DESPUÉS (Seguro)                      │
├─────────────────────────────────────────────────────────┤
│  Subir → Guardar solo el filePath relativo              │
│  Descargar → Generar signed URL temporal → Abrir        │
└─────────────────────────────────────────────────────────┘
```

### Detalles Técnicos

- Las signed URLs expiran después de 1 hora (3600 segundos)
- Solo usuarios con rol `producer` o `admin` pueden acceder (gracias a las políticas RLS ya configuradas)
- El campo `tema_principal_documento_url` ahora guardará el path relativo, no la URL completa


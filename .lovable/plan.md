# Corregir “Acceso denegado” después de iniciar sesión

## Diagnóstico confirmado

- El inicio de sesión ya se completa: la captura nueva muestra al usuario autenticado como `racevedo@caracoltv.com.co`.
- Ese correo **sí está autorizado** por las dos reglas vigentes: pertenece al dominio corporativo y tiene rol de productor.
- La misma validación que ejecuta la app devuelve `true` al consultarla directamente.
- Por tanto, el mensaje “Acceso denegado” es incorrecto. El problema está en la comprobación del navegador: ante un fallo temporal de red, actualmente convierte cualquier error de consulta en una denegación definitiva.

## Plan

1. **Corregir la validación de acceso**
   - Validar la identidad actual con el servidor antes de decidir el acceso.
   - Permitir directamente los correos verificados de `@caracoltv.com.co`, conforme a la regla ya definida para el proyecto.
   - Mantener la comprobación remota para las excepciones externas autorizadas.

2. **No confundir un fallo de conexión con falta de permisos**
   - Si la comprobación remota falla, mostrar “No pudimos verificar tu acceso” con una opción para reintentar.
   - Reservar “Acceso denegado” únicamente para una respuesta válida que realmente indique que el correo no está autorizado.

3. **Evitar decisiones cruzadas**
   - Cancelar comprobaciones anteriores cuando cambie la sesión, para que una respuesta tardía no reemplace un acceso válido.
   - Mantener el acceso público de solo lectura cuando no haya una sesión iniciada.

4. **Verificar el resultado**
   - Probar el acceso con una sesión real y confirmar que `racevedo@caracoltv.com.co` entra al calendario con permisos de productor.
   - Probar también el estado sin sesión y el caso de un correo externo no autorizado.

## Detalles técnicos

- Cambios concentrados en `src/components/AuthGuard.tsx` y, si hace falta para el estado de reintento, `src/components/AccessDenied.tsx`.
- Usar `supabase.auth.getUser()` para revalidar al usuario, en lugar de confiar únicamente en la sesión local.
- Separar estados `loading`, `allowed`, `denied` y `verification_error`.
- No se modifican tablas, datos, roles ni políticas de acceso.

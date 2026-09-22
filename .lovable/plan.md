# Arreglar el acceso (error "Failed to fetch" al iniciar sesión)

## Qué se comprobó hasta ahora

- El servidor de cuentas de la app **sí está funcionando**: al probarlo directamente responde correctamente (con una contraseña falsa devuelve "credenciales inválidas", que es la respuesta esperada).
- Al reproducir el inicio de sesión dentro de la app, el botón se queda en **"Procesando…"** y la petición **nunca sale del navegador**. Eso coincide con el mensaje "Failed to fetch" que ves.
- No hay referencias al servidor antiguo (el que se usó en la migración externa) en el código.

Conclusión: el problema está en el **lado del navegador / la conexión de la app**, no en las cuentas ni en las contraseñas. La causa exacta todavía no está confirmada, así que el primer paso del plan es confirmarla.

## Plan

1. **Confirmar la causa**
   - Revisar el almacenamiento de sesión especial que usa la vista previa de Lovable, que es lo que está dejando el botón colgado en "Procesando…".
   - Comprobar si la app publicada (blu-planner.lovable.app) tiene el mismo problema o solo la vista previa. Esto distingue entre un fallo de la app y un bloqueo de la red corporativa.

2. **Evitar que el botón se quede colgado**
   - Añadir un tiempo límite al inicio de sesión: si no hay respuesta en unos segundos, mostrar un mensaje claro ("No se pudo conectar con el servidor, revisa tu conexión e inténtalo de nuevo") en vez de quedarse en "Procesando…" para siempre.
   - Mostrar el motivo real del fallo (sin datos técnicos) para que se distinga entre contraseña incorrecta y problema de conexión.

3. **Asegurar la conexión al servidor correcto**
   - Verificar que la app apunta al servidor activo y que la clave pública coincide, y corregirlo si hay desajuste.
   - Volver a comprobar el inicio de sesión con una cuenta real hasta que entre al calendario.

4. **Si resulta ser bloqueo de red**
   - Si la app publicada funciona y solo falla en tu equipo/oficina, te indicaré exactamente qué dirección debe permitir el área de tecnología de Caracol, sin cambios en el código.

## Detalles técnicos

- Reproducción con Playwright en `/auth`: `signInWithPassword` no emite ninguna petición a `/auth/v1/token`; la UI queda en estado `loading`. Sospecha principal: `brokeredPreviewStorage()` en `src/integrations/supabase/client.ts` (archivo autogenerado, no editable) bloqueando el flujo, más un fallo de red real en el navegador del usuario.
- Comprobación directa: `POST https://<ref>.supabase.co/auth/v1/token?grant_type=password` → 400 `invalid_credentials` (servicio sano). `auth/v1/health` → 200.
- Cambios previstos, todos en `src/pages/Auth.tsx`: `Promise.race` con timeout sobre la llamada de login, `finally` que garantice `setLoading(false)`, y mapeo de errores de red vs. credenciales a mensajes en español.
- No se toca el esquema de la base de datos ni las políticas de acceso.

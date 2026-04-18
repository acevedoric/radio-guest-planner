

## Plan: Acceso restringido por correo electrónico autorizado

### Contexto

Hoy cualquiera con cuenta puede registrarse en `/auth` y entrar a la app. La imagen muestra el patrón deseado: **solo correos previamente autorizados** pueden acceder; el resto ve "Access denied" con opción de "Solicitar acceso".

La app ya usa Supabase Auth (login/registro/recuperación) y RLS sobre `guests` con roles producer/admin. Vamos a añadir una **lista blanca (allowlist) de correos autorizados** gestionada en BD + un guard de ruta que bloquea a usuarios no autorizados.

### Diseño

**1. Tabla `allowed_emails`** (nueva)
- `id uuid pk`, `email text unique not null` (lowercased), `note text`, `created_at`, `created_by uuid`.
- RLS: solo `admin` puede `select/insert/update/delete` (vía `has_role`).

**2. Tabla `access_requests`** (nueva, para "Solicitar acceso")
- `id`, `email`, `message text`, `status text default 'pending'` (`pending|approved|rejected`), `created_at`.
- RLS: cualquiera autenticado puede `insert` su propio email; solo `admin` puede `select/update`.

**3. Función SQL `is_email_allowed(_email text) returns boolean`** (`security definer`, search_path `public`)
- Devuelve `true` si el correo está en `allowed_emails` (case-insensitive) **o** si el usuario ya tiene rol admin/producer en `user_roles`.

**4. Bloqueo en signup (server-side)**
- Trigger `before insert on auth.users` → si `is_email_allowed(NEW.email)` es false → `raise exception 'EMAIL_NOT_ALLOWED'`.
- Esto impide que se creen cuentas no autorizadas aunque alguien intente registrarse directo.

**5. Guard en cliente (`AuthGuard`)**
- Nuevo componente que envuelve rutas privadas (`/`, `/search`).
- Flujo:
  1. Si no hay sesión → redirige a `/auth`.
  2. Si hay sesión → consulta `is_email_allowed(session.user.email)` vía RPC.
  3. Si `false` → muestra pantalla **"Acceso denegado"** (mismo estilo de la imagen: card centrada, mensaje con su email, botones "Solicitar acceso" y "Cerrar sesión").
  4. Si `true` → renderiza children.

**6. Pantalla "Acceso denegado"** (`src/components/AccessDenied.tsx`)
- Card con: título "Acceso denegado", texto "Tú ([email]) no tienes acceso a este proyecto. Solicita acceso al equipo.", botón **"Solicitar acceso"** (abre dialog con textarea opcional → inserta en `access_requests`) y botón **"Cerrar sesión"**.

**7. Manejo de error en `Auth.tsx`**
- Si `signUp` devuelve error con mensaje `EMAIL_NOT_ALLOWED` → toast: "Este correo no está autorizado. Solicita acceso al administrador." + botón que lleva al formulario de solicitud (reutiliza `access_requests`).

**8. (Opcional, no incluido por defecto)** Página admin `/admin/access` para gestionar `allowed_emails` y aprobar `access_requests`. Lo dejo fuera de este plan salvo que lo pidas — por ahora la gestión inicial se hace insertando filas vía migración o directamente en BD.

### Bootstrapping

En la misma migración, insertar tu correo (`racevedo@caracoltv.com.co`, visto en logs) en `allowed_emails` para no quedar bloqueado. Confirmar si quieres añadir otros correos iniciales.

### Archivos

| Archivo | Cambio |
|---|---|
| Migración SQL (nueva) | Tablas `allowed_emails`, `access_requests`, función `is_email_allowed`, trigger en `auth.users`, RLS, seed inicial |
| `src/components/AuthGuard.tsx` | Nuevo: chequea sesión + allowlist vía RPC |
| `src/components/AccessDenied.tsx` | Nuevo: pantalla estilo imagen + dialog "Solicitar acceso" |
| `src/App.tsx` | Envolver `/`, `/search` con `<AuthGuard>` |
| `src/pages/Auth.tsx` | Capturar error `EMAIL_NOT_ALLOWED` y ofrecer solicitar acceso |

### Lo que NO incluye

- UI de admin para aprobar solicitudes (puede ser un siguiente paso).
- Notificación por email al admin cuando llega una nueva solicitud (requeriría edge function + Resend; lo planteamos aparte si lo quieres).

### Pregunta antes de implementar

¿Qué correos quieres pre-autorizar en la migración inicial? Mínimo el tuyo (`racevedo@caracoltv.com.co`). Si me confirmas la lista, los incluyo; si no, solo agrego el tuyo y los demás se gestionan después.


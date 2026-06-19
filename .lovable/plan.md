
## Plan: Restringir registro al dominio @caracoltv.com.co

### Diagnóstico
El error "Database error saving new user" viene del trigger `enforce_email_allowlist` sobre `auth.users`, que llama a `is_email_allowed(email)`. Esa función solo permite emails que estén en la tabla `allowed_emails` o que ya tengan rol `admin`/`producer`. Cualquier email nuevo fuera de esa lista (incluido el que intentaste) rompe el signup con `EMAIL_NOT_ALLOWED`.

### Recomendación
**No** desactivar el registro por completo: actualmente la app depende de `auth.users` + `user_roles`, y sin signup no hay forma de añadir productores nuevos sin entrar a la consola. Mejor dejar el signup abierto **solo** para correos `@caracoltv.com.co`, que es lo que pediste como alternativa. Los emails sueltos en `allowed_emails` siguen funcionando como excepción (invitados externos).

### Cambios

**Migración SQL** (modifica únicamente la función `is_email_allowed`):

```sql
CREATE OR REPLACE FUNCTION public.is_email_allowed(_email text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- 1) Dominio corporativo permitido por defecto
    lower(trim(_email)) LIKE '%@caracoltv.com.co'
    -- 2) Excepciones individuales en allowed_emails
    OR EXISTS (
      SELECT 1 FROM public.allowed_emails
      WHERE email = lower(trim(_email))
    )
    -- 3) Usuarios ya con rol admin/producer
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN auth.users u ON u.id = ur.user_id
      WHERE lower(u.email) = lower(trim(_email))
        AND ur.role IN ('admin'::app_role, 'producer'::app_role)
    );
$$;
```

No se tocan tablas, RLS, ni el frontend. El trigger `enforce_email_allowlist` sigue rechazando cualquier email que no cumpla ninguna de las 3 condiciones, con el mismo mensaje `EMAIL_NOT_ALLOWED`.

### UX del error
Opcional: en `src/pages/Auth.tsx` (o equivalente), detectar el mensaje `EMAIL_NOT_ALLOWED` / `Database error saving new user` y mostrar un toast más claro: *"Solo se permiten correos @caracoltv.com.co"*. Lo incluyo en esta misma tanda si lo apruebas; si no, queda solo la migración.

### No incluye
- Desactivar el signup (descartado por la recomendación arriba; si lo prefieres igual, lo hacemos con `configure_auth { disable_signup: true }` y administras altas vía `allowed_emails` + invitación manual).
- Migrar usuarios existentes ni tocar `allowed_emails`.

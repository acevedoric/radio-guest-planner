

## Plan: Validación de Email en Recuperación de Contraseña

### Problema Identificado

1. **El email de recuperación no llegó**: El log muestra que la solicitud fue procesada correctamente (status 200), pero el email puede no haber llegado. Esto puede deberse a:
   - El email fue a la carpeta de spam/no deseado
   - El email que usaste no está registrado en el sistema
   - Retraso en la entrega del proveedor de emails

2. **Supabase no indica si el email existe**: Por seguridad, `resetPasswordForEmail()` siempre retorna éxito aunque el email no esté registrado (para prevenir que atacantes descubran qué emails están registrados).

### Solución Propuesta

Crear una edge function que verifique si el email existe antes de intentar la recuperación:

```text
┌─────────────────────────────────────────────────────────────────┐
│  1. Usuario ingresa email para recuperación                    │
│     ↓                                                           │
│  2. Frontend llama a edge function "check-email-exists"        │
│     ↓                                                           │
│  3. Edge function consulta auth.users (con service_role_key)   │
│     ↓                                                           │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ¿Email existe?                                             │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │ SÍ → Proceder con resetPasswordForEmail()                 │ │
│  │ NO → Mostrar error y link a registro                      │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Cambios a Realizar

| Archivo | Acción |
|---------|--------|
| `supabase/functions/check-email-exists/index.ts` | Crear - Edge function para verificar email |
| `src/pages/Auth.tsx` | Modificar - Llamar a la edge function antes de recuperar |

### Detalles Técnicos

**Nueva Edge Function: `check-email-exists`**
- Recibe el email como parámetro
- Usa `SUPABASE_SERVICE_ROLE_KEY` para consultar `auth.users`
- Retorna `{ exists: true/false }`

**Modificación en Auth.tsx**
- `handleForgotPassword` primero llama a la edge function
- Si el email no existe:
  - Mostrar mensaje: "Este email no está registrado"
  - Mostrar botón para ir a registro
- Si existe: proceder con la recuperación normal

### Nota sobre el Email no Recibido

Primero deberíamos verificar:
1. ¿El email que usaste está realmente registrado en el sistema?
2. ¿Revisaste la carpeta de spam?

Si el email sí está registrado y no llega, podemos configurar Resend como proveedor de emails (requiere API key y dominio verificado).


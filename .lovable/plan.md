

## Plan: Mejorar Login con Visibilidad de Contraseña y Recuperación

### Cambios a Implementar

**Archivo: `src/pages/Auth.tsx`**

#### 1. Toggle de Visibilidad de Contraseña (Ojito)

- Agregar estado `showPassword` y `showConfirmPassword`
- Agregar icono Eye/EyeOff de lucide-react junto al input de contraseña
- El input cambia entre `type="password"` y `type="text"` según el estado

#### 2. Campo de Confirmación de Contraseña (Solo en Registro)

- Agregar estado `confirmPassword`
- Mostrar segundo campo de contraseña solo cuando `!isLogin`
- Validar que ambas contraseñas coincidan antes de enviar el formulario
- Mostrar mensaje de error si no coinciden

#### 3. Link "Olvidé mi Contraseña"

- Agregar link visible solo en modo login
- Implementar función `handleForgotPassword` que usa `supabase.auth.resetPasswordForEmail()`
- Supabase envía automáticamente un email con link de recuperación
- Agregar una nueva ruta `/reset-password` para manejar el token

**Nuevo archivo: `src/pages/ResetPassword.tsx`**

- Página para establecer nueva contraseña
- Recibe el token de recuperación de la URL
- Permite al usuario ingresar y confirmar nueva contraseña
- Usa `supabase.auth.updateUser({ password })` para actualizar

### Flujo de Recuperación de Contraseña

```text
┌──────────────────────────────────────────────────────────────┐
│  1. Usuario hace clic en "¿Olvidaste tu contraseña?"         │
│     ↓                                                        │
│  2. Ingresa su email                                         │
│     ↓                                                        │
│  3. Supabase envía email automáticamente con link            │
│     ↓                                                        │
│  4. Usuario hace clic en el link del email                   │
│     ↓                                                        │
│  5. Llega a /reset-password con el token                     │
│     ↓                                                        │
│  6. Ingresa nueva contraseña (con confirmación)              │
│     ↓                                                        │
│  7. Contraseña actualizada, redirige a login                 │
└──────────────────────────────────────────────────────────────┘
```

### Detalles de UI

**Input con toggle de visibilidad:**
- El campo de contraseña tendrá un botón con icono de ojo a la derecha
- Eye = contraseña visible, EyeOff = contraseña oculta
- El botón no afecta el foco del input

**Validación de contraseñas en registro:**
- Si las contraseñas no coinciden, mostrar error "Las contraseñas no coinciden"
- Deshabilitar botón de registro si no coinciden

**Modal/Vista para "Olvidé contraseña":**
- Opción A: Usar un estado para mostrar vista alternativa en la misma página
- Opción B: Crear página separada

Recomiendo Opción A para mantener todo simple.

### Archivos a Modificar/Crear

| Archivo | Acción |
|---------|--------|
| `src/pages/Auth.tsx` | Modificar - agregar toggle, confirmación, forgot password |
| `src/pages/ResetPassword.tsx` | Crear - página para nueva contraseña |
| `src/App.tsx` | Modificar - agregar ruta /reset-password |

### Nota sobre Emails

Supabase Auth envía emails de recuperación automáticamente. El email usa la plantilla predeterminada de Supabase. Si quieres personalizar el diseño del email, eso requeriría configuración adicional con Resend.


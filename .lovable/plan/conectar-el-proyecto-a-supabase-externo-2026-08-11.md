# Conectar el proyecto a Supabase externo

Objetivo: que la app use el proyecto Supabase `sasufaphjchzfhmimovb` en vez del backend actual, sin tocar el schema ni borrar datos.

## Importante antes de empezar

El backend actual está gestionado por Lovable Cloud. Mientras Cloud esté activo, el archivo de variables de entorno y el cliente de base de datos son generados automáticamente y siempre apuntan al proyecto gestionado: no puedo redirigirlos desde el código.

Desconectar Cloud es **irreversible** y borra de forma permanente los datos, storage y funciones del backend actual. Como los datos ya están migrados al proyecto externo, esto es aceptable, pero conviene confirmar antes de hacerlo que:

- Las tablas `guests`, `user_roles`, `allowed_emails`, `access_requests` existen en el proyecto externo con sus datos.
- Las políticas de acceso (RLS), las funciones `has_role` / `is_email_allowed` y sus triggers están creadas allí.
- El bucket de documentos `guest-documents` y sus archivos están replicados.
- Los usuarios de autenticación están migrados (si no, habrá que volver a invitarlos).

## Pasos

1. **Tú**: en la pestaña Cloud → Advanced → Disconnect (requiere ser admin del workspace).
2. **Tú**: conectar el proyecto Supabase externo desde la integración de Supabase, iniciando sesión con la cuenta dueña de `sasufaphjchzfhmimovb`. Al conectarlo se escriben automáticamente la URL y la clave publicable del proyecto.
3. **Yo**: verificar que el cliente generado apunte a la nueva URL y que la clave publicable sea `sb_publishable_6HxUfNkzEz8ItBNeWKlQ8w_hv8NnyOW`, y regenerar los tipos de base de datos a partir del schema existente (solo lectura del schema, sin migraciones).
4. **Yo**: redeploy de las funciones de servidor existentes (`check-email-exists`, `get-libreto`, `n8n-guest-info`, `trigger-n8n-scraping`, `import-excel-guests`, `chat-guests`, `mcp`) en el proyecto nuevo, sin cambiar su lógica.
5. **Yo**: reconfigurar los secretos que usan esas funciones (`N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`, `LOVABLE_API_KEY`) y actualizar la referencia del proyecto usada por el servidor MCP y el flujo OAuth.
6. **Yo**: verificación funcional — cargar el calendario sin sesión (modo lectura pública), iniciar sesión, y comprobar lectura/edición de invitados y descarga de documentos.

## Notas técnicas

- No se ejecutará ninguna migración de schema ni borrado de datos en el proyecto externo; solo lectura para generar los tipos.
- El servidor MCP y el consentimiento OAuth dependen del identificador del proyecto; se actualizan solos al leer la nueva variable de entorno, pero hay que revalidar el emisor OAuth.
- Si la vista `guests_anon` (datos sensibles ocultos para visitantes) no fue migrada, la vista pública fallará; en ese caso te aviso y la recreamos con tu autorización explícita, ya que implicaría un cambio de schema.
- Las claves de servicio y la contraseña de base de datos del proyecto externo las administras tú; nunca se exponen en el código del navegador.

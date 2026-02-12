

## Plan: Leer respuesta directa del webhook de n8n

### Problema

La funcion `trigger-n8n-scraping` envia correctamente la solicitud a n8n y recibe una respuesta exitosa (200), pero **descarta el body de la respuesta**. Tu workflow de n8n devuelve los datos de scraping directamente en la respuesta HTTP (webhook response), no hace un POST separado al callback.

### Solucion

Modificar `trigger-n8n-scraping` para que:
1. Lea el body de la respuesta de n8n
2. Si contiene datos de los 4 bloques, los guarde directamente en la base de datos
3. Si no contiene datos, mantenga el comportamiento actual (esperar callback)

### Cambios

| Archivo | Accion |
|---------|--------|
| `supabase/functions/trigger-n8n-scraping/index.ts` | Modificar - Leer respuesta de n8n y guardar datos en la BD |

### Detalles Tecnicos

Despues de recibir la respuesta exitosa de n8n:

```text
1. Parsear el body de la respuesta como JSON
2. Verificar si contiene campos: tema_principal, infancia_vida_privada,
   carrera_profesional, datos_curiosos
3. Si tiene al menos un campo, hacer UPDATE en la tabla guests
   con los datos recibidos + n8n_updated_at = now()
4. Retornar exito indicando si los datos fueron guardados
```

Esto usa `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` que ya estan disponibles como variables de entorno en las edge functions.

### Resultado esperado

Al presionar el boton de IA, la informacion de n8n se guardara inmediatamente en los 4 bloques sin necesidad de que n8n llame a un callback separado.



## Plan: Corregir parseo de respuesta n8n (array) y separar contenido en 4 bloques

### Problema detectado

n8n con "All Incoming Items" devuelve un **array** en lugar de un objeto:

```text
Respuesta actual:  [{"output": "texto largo con toda la info..."}]
Esperado por el codigo: {"output": "texto largo..."}
```

El edge function hace `n8nData.output` pero `n8nData` es un array, asi que `output` es `undefined` y no guarda nada.

Ademas, el campo `output` es un **string largo** con las 4 secciones mezcladas en texto. Para que se muestre correctamente en los 4 bloques, hay que parsear el texto y separar las secciones.

### Solucion

**Archivo: `supabase/functions/trigger-n8n-scraping/index.ts`**

1. Si el JSON parseado es un array, usar el primer elemento: `n8nData = n8nData[0]`
2. Cuando `output` es un string largo, parsearlo buscando los encabezados de seccion que usa el AI Agent:
   - "1. Evento Actual de Coyuntura" o similar -> `tema_principal`
   - "2. Infancia y Vida Personal" -> `infancia_vida_privada`
   - "3. Carrera Artistica o Profesional" -> `carrera_profesional`
   - "4. Datos Curiosos" -> `datos_curiosos`
3. Si no se detectan secciones, guardar todo el texto en `tema_principal` como fallback

No se necesitan cambios en el frontend: `GuestInfoModules` y `DayView` ya tienen el flujo correcto para re-consultar y mostrar los datos.

### Detalles tecnicos

**Edge function** - Cambios en el parseo:

```text
1. Despues de JSON.parse(responseText):
   - Si Array.isArray(n8nData) -> n8nData = n8nData[0]

2. Cuando output es string, nueva funcion parseOutputSections(text):
   - Usar regex para encontrar secciones numeradas (1., 2., 3., 4.)
   - Extraer contenido entre cada encabezado
   - Retornar objeto con los 4 campos

3. Fallback: si el regex no encuentra secciones,
   guardar todo en tema_principal
```

Flujo completo validado:
```text
n8n retorna [{"output": "texto..."}]
  -> Edge function parsea array[0].output
  -> Separa texto en 4 secciones via regex
  -> Guarda en BD con supabase service role
  -> Retorna data_saved: true
  -> GuestInfoModules re-fetch guest
  -> onGuestUpdate propaga a DayView -> Index
  -> Los 4 bloques muestran la info
```

| Archivo | Accion |
|---------|--------|
| `supabase/functions/trigger-n8n-scraping/index.ts` | Soportar array, parsear string en 4 secciones |


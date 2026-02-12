

## Plan: Soportar respuesta de n8n con campo "output"

### Problema detectado

El log muestra que n8n devuelve un body vacio o con una estructura diferente a la esperada. La expresion de n8n `{{ $item("0").$node["Respond to Webhook"].json["output"] }}` sugiere que los datos vienen envueltos en un campo `output`.

Posibles estructuras de respuesta de n8n:

```text
Opcion A: { "output": "texto con toda la info" }
Opcion B: { "output": { "tema_principal": "...", ... } }
Opcion C: Body completamente vacio (nodo Respond to Webhook no configurado)
```

### Solucion

Modificar `trigger-n8n-scraping` para manejar multiples estructuras de respuesta:

1. Si la respuesta tiene los 4 campos directamente -> guardarlos (ya implementado)
2. Si la respuesta tiene un campo `output` que es un objeto con los 4 campos -> extraerlos y guardarlos
3. Si `output` es un string -> guardarlo en `tema_principal` como texto general
4. Agregar logs detallados para diagnosticar la estructura exacta

Ademas, modificar `GuestInfoModules` para que al presionar el boton de IA:
- Espere la respuesta del edge function
- Si `data_saved: true`, re-consulte el guest actualizado de la BD y actualice la UI inmediatamente via `onGuestUpdate`

### Cambios

| Archivo | Accion |
|---------|--------|
| `supabase/functions/trigger-n8n-scraping/index.ts` | Soportar campo `output` en la respuesta de n8n |
| `src/components/GuestInfoModules.tsx` | Refrescar datos del guest tras respuesta exitosa del edge function |

### Detalles tecnicos

**Edge function** - Parseo flexible:
```text
1. Leer responseText de n8n
2. Parsear como JSON
3. Si tiene campo "output":
   a. Si output es objeto -> buscar los 4 campos dentro
   b. Si output es string -> guardar como tema_principal
4. Si no tiene "output" -> buscar los 4 campos en raiz (actual)
5. Guardar en BD con n8n_updated_at
6. Retornar los datos guardados en la respuesta del edge function
```

**Frontend** - Actualizacion inmediata:
```text
1. handleTriggerAI llama al edge function
2. Lee la respuesta con { data_saved, guest_id }
3. Si data_saved es true:
   - Hace SELECT del guest actualizado
   - Llama onGuestUpdate con los nuevos valores
   - Los modulos se actualizan sin recargar pagina
```


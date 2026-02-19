

## Plan: Corregir 3 problemas en vista DIA

### Problema 1: Pop-up se abre con cada accion

La Card completa tiene un `onClick` en la linea 113 de `DayView.tsx`:
```text
onClick={() => editMode && (guest ? onGuestClick(guest) : onAddGuest(selectedDay, slot))}
```
Cualquier clic dentro de la tarjeta (checkboxes, botones de IA, modulos colapsables) hace "bubble up" y abre el modal de edicion.

**Solucion**: Quitar el `onClick` de la Card y agregar un boton explicito "Editar" en el header de la tarjeta, o mover el onClick solo al area del nombre del invitado. Tambien agregar `e.stopPropagation()` en los checkboxes y otros elementos interactivos.

### Problema 2: Toda la info va a TEMA PRINCIPAL en vez de separarse en 4 bloques

Los logs confirman: `Parsed sections: tema_principal` -- el regex solo encuentra 1 seccion.

La razon: n8n devuelve headers con formato `### COYUNTURA ###`, `### INFANCIA ###`, `### CARRERA ###`, `### CURIOSIDADES ###` pero el regex actual busca secciones numeradas tipo `1.`, `2.`, `3.`, `4.`.

**Solucion**: Actualizar `parseOutputSections()` en la Edge Function para detectar AMBOS formatos:
- Numerados: `1. Titulo`, `2. Titulo`...
- Con hashtags: `### COYUNTURA ###`, `### INFANCIA ###`...

Mapeo de keywords:
- COYUNTURA -> `tema_principal`
- INFANCIA -> `infancia_vida_privada`
- CARRERA -> `carrera_profesional`
- CURIOSIDADES / CURIOSOS -> `datos_curiosos`

### Problema 3: Texto con ** no se muestra en negrilla

Actualmente `GuestInfoModules` muestra el contenido con `whitespace-pre-wrap` como texto plano. El markdown `**texto**` no se renderiza.

**Solucion**: Crear una funcion que convierta `**texto**` a elementos `<strong>` de React (sin usar dangerouslySetInnerHTML) y aplicarla al mostrar el contenido de cada modulo.

---

### Detalles tecnicos

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/trigger-n8n-scraping/index.ts` | Actualizar `parseOutputSections()` para soportar headers `### KEYWORD ###` ademas de numerados |
| `src/components/DayView.tsx` | Quitar onClick de la Card, agregar boton/area especifica para abrir modal, stopPropagation en checkboxes |
| `src/components/GuestInfoModules.tsx` | Renderizar `**texto**` como negrilla usando React elements |

### Flujo corregido del parseo:

```text
n8n response: {"output": "### COYUNTURA ###\n...\n### INFANCIA ###\n...\n### CARRERA ###\n...\n### CURIOSIDADES ###\n..."}

parseOutputSections() detecta ### KEYWORD ###
  -> COYUNTURA -> tema_principal
  -> INFANCIA -> infancia_vida_privada  
  -> CARRERA -> carrera_profesional
  -> CURIOSIDADES -> datos_curiosos

Cada campo se guarda por separado en la BD
Frontend muestra cada campo en su modulo correspondiente con negrillas
```




## Mejorar la Busqueda Global

### Problema identificado

La busqueda actual solo busca en los campos **nombre** y **tema** del invitado. Si buscas "ACTOR", no encuentra a nadie porque el cargo/posicion ("Actor", "Actriz") no esta incluido en la consulta. Tampoco busca en notas ni otros campos relevantes.

Ademas, los resultados se muestran en un pequeno dropdown que no permite ver bien la informacion. El usuario necesita una pagina de resultados con resumen.

### Solucion

1. **Ampliar la busqueda** para incluir los campos: `name`, `topic`, `position`, `notes` y `program_type`
2. **Crear una pagina de resultados de busqueda** (`/search`) que muestre una lista completa con:
   - Nombre del invitado
   - Cargo/posicion
   - Tema
   - Fecha programada (semana + dia)
   - Estado de grabacion
   - Posibilidad de hacer clic para navegar al dia del invitado

3. **Mantener el dropdown** para resultados rapidos (maximo 5), con un enlace "Ver todos los resultados" que lleve a la pagina completa

### Detalles tecnicos

| Archivo | Cambio |
|---------|--------|
| `src/pages/SearchResults.tsx` | Nueva pagina con lista de resultados, fecha, posicion y resumen |
| `src/pages/Index.tsx` | Ampliar query de busqueda para incluir `position`, `notes`. Agregar navegacion a pagina de resultados |
| `src/components/FilterBar.tsx` | Agregar boton "Ver todos" en el dropdown cuando hay resultados. Mostrar posicion en cada resultado |
| `src/App.tsx` | Agregar ruta `/search` |

### Pagina de resultados

La pagina mostrara:
- Titulo con el termino buscado y cantidad de resultados
- Lista de tarjetas con: nombre, posicion, tema, fecha (dia + semana), estado
- Cada tarjeta es clickeable y navega al dia correspondiente del invitado
- Boton para volver al calendario

### Query mejorada

La consulta pasara de:
```
.or(`name.ilike.%query%,topic.ilike.%query%`)
```
A:
```
.or(`name.ilike.%query%,topic.ilike.%query%,position.ilike.%query%,notes.ilike.%query%,program_type.ilike.%query%`)
```

Esto permitira encontrar invitados buscando por cargo ("actor", "cantante", "comediante"), por tema, por nombre o por notas.


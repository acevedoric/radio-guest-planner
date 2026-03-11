

## Mejorar Busqueda: Separar en categorias INVITADOS y PRENSA

### Problema
La busqueda actual no incluye los campos `press_contact` ni `press_phone`, y muestra todos los resultados mezclados sin distincion entre datos del invitado y datos de prensa.

### Solucion

Separar la busqueda en dos categorias con tabs/secciones en el dropdown y en la pagina de resultados:

**1. INVITADOS** - Busca en: `name`, `topic`, `position`, `notes`, `program_type`, `tema_principal`
**2. PRENSA** - Busca en: `press_contact`, `press_phone`

### Cambios

| Archivo | Cambio |
|---------|--------|
| `src/pages/Index.tsx` | En `searchAllGuests`, ejecutar dos queries separadas: una para invitados y otra para prensa. Devolver ambos conjuntos al FilterBar |
| `src/components/FilterBar.tsx` | Mostrar el dropdown con dos secciones: "Invitados" y "Prensa". Cada seccion muestra sus resultados con formato distinto (invitados muestra nombre+tema, prensa muestra jefe de prensa+telefono+nombre del invitado asociado) |
| `src/pages/SearchResults.tsx` | Agregar tabs "Invitados" / "Prensa" con queries separadas. En prensa mostrar contacto, telefono y el invitado al que pertenece |

### Detalle tecnico

**Query INVITADOS:**
```
.or(`name.ilike.%q%,topic.ilike.%q%,position.ilike.%q%,program_type.ilike.%q%,tema_principal.ilike.%q%`)
```

**Query PRENSA:**
```
.or(`press_contact.ilike.%q%,press_phone.ilike.%q%`)
```

**Estado en Index.tsx:**
- `globalSearchResults` pasa a ser un objeto `{ guests: Guest[], press: Guest[] }`

**Dropdown en FilterBar:**
- Seccion "INVITADOS" con icono de persona: nombre, posicion, tema, fecha
- Seccion "PRENSA" con icono de telefono: nombre del contacto de prensa, telefono, y debajo el nombre del invitado asociado
- Boton "Ver todos los resultados" al final

**Pagina SearchResults:**
- Dos tabs: "Invitados" y "Prensa"
- Tab Prensa muestra tarjetas con: nombre del jefe de prensa, telefono, y el invitado/fecha asociados


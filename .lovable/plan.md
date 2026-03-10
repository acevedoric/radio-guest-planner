

## Agregar campo de hora cuando el estado es "A GRABAR"

### Cambios necesarios

**1. Base de datos** -- Agregar columna `scheduled_time` (tipo `time`, nullable) a la tabla `guests`.

```sql
ALTER TABLE public.guests ADD COLUMN scheduled_time time WITHOUT TIME ZONE DEFAULT NULL;
```

**2. Tipo Guest** (`src/types/guest.ts`) -- Agregar `scheduled_time?: string | null`.

**3. Modal** (`src/components/GuestDetailModal.tsx`):
- Inicializar `scheduled_time` en el estado del formulario.
- Cuando `recording_status === "to_record"`, mostrar fecha y hora en la misma linea usando un grid de 2 columnas:

```
[ Fecha para Grabar  ] [ Hora  ]
```

- Para los otros estados (`postponed`, `proposed`), mantener solo la fecha como esta.
- Limpiar `scheduled_time` cuando el estado cambie a `live` o `recorded`.

**4. Guardar** -- Incluir `scheduled_time` en el objeto que se pasa a `onSave`.

Layout del campo condicional cuando es "A GRABAR":
```text
┌──────────────────────┬────────────────┐
│ Fecha para Grabar    │ Hora           │
│ [____date____]       │ [__time__]     │
└──────────────────────┴────────────────┘
```

Ambos inputs en una sola fila con `grid grid-cols-2 gap-4`.




## Plan: Importar invitados confirmados desde el Excel

### Resumen

Crearé una función backend temporal que contiene todos los invitados parseados del Excel y los inserta en la base de datos. Después de ejecutarla, se puede eliminar.

### Datos identificados

Del Excel se extraen aproximadamente **120+ invitados confirmados** distribuidos así:

| Mes | Semanas | Entradas con invitado |
|-----|---------|----------------------|
| Enero 2026 | 12, 19, 26 | ~18 |
| Febrero 2026 | 2, 9, 16, 23 | ~48 |
| Marzo 2026 | 2, 9, 16, 23, 30 | ~50 |
| Abril 2026 | 6, 13, 20, 27 | ~15 |
| Mayo 2026 | 4-25 | ~5 |

### Reglas de mapeo

| Excel | Campo en BD |
|-------|-------------|
| Slot 1/2 (VIVO) | `recording_status = 'live'` |
| Slot 3 (GRABADO) | `recording_status = 'recorded'` |
| "Invitado: [nombre], [cargo]" | `name`, `position` |
| "Tema: [texto]" | `topic` |
| "Contacto: [tel]" | `phone` |
| "Grabación: [fecha] [hora]" | `scheduled_date`, `scheduled_time` |
| Prefijos como "Jueves de comedia a domicilio" | `program_type` |
| Entradas vacías / "NO HAY PROGRAMA" | Se omiten |

### Implementación

1. **Crear edge function `import-excel-guests`** con todos los datos parseados como JSON hardcoded
2. **Ejecutar la función** una sola vez para insertar todos los registros
3. La función verificará duplicados por `week_date + day_of_week + time_slot + name` antes de insertar

### Archivos

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/import-excel-guests/index.ts` | Nueva función con datos parseados y lógica de inserción |




## Mejoras visuales: dias pasados, indicador REC, y franja de grabacion

### 3 cambios principales

**1. Transparencia 20% en dias pasados (vista MES)**

En `MonthView.tsx`, comparar cada dia con `new Date()`. Si el dia ya paso, aplicar `opacity-20` a la Card del dia.

**2. Reemplazar icono 📹 por boton rojo "REC"**

En `MonthView.tsx`, reemplazar el emoji de camara y el badge numerico por un boton estilo:
```
[● REC 3]
```
- Fondo rojo (`bg-red-600`), texto blanco, con un circulo solido como indicador.
- Mantener la logica de click que navega a `onScheduledDateClick`.
- Eliminar el sistema de colores por urgencia (todo rojo uniforme tipo "REC").

**3. Franja de grabacion programada en las 3 vistas**

Para invitados con `recording_status === 'to_record'` y `scheduled_date`, mostrar una franja sutil en el dia donde esta programada la grabacion (no donde se emite).

Logica: recorrer todos los guests, agrupar por `scheduled_date`, y en cada dia que coincida, mostrar una barra con el nombre del invitado.

| Vista | Implementacion |
|-------|---------------|
| **MES** | Debajo del numero del dia, si hay grabaciones ese dia, mostrar una franja fina con fondo `bg-red-500/10` y texto rojo con el nombre truncado. Click navega al dia. |
| **SEMANA** | Encima de los slots del dia correspondiente, una barra horizontal con `bg-red-500/10 border-l-2 border-red-500` mostrando "🔴 Grab: [nombre]". Click abre el modal del invitado. |
| **DIA** | Banner en la parte superior del dia: "Grabacion programada: [nombre] - [hora]". Click abre el modal. |

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/MonthView.tsx` | Opacidad dias pasados, boton REC, franja grabacion |
| `src/components/WeeklyCalendar.tsx` | Franja grabacion en dias con grabaciones programadas |
| `src/components/DayView.tsx` | Banner de grabacion programada |
| `src/pages/Index.tsx` | Pasar todos los guests (no solo los de la semana actual) para poder cruzar `scheduled_date` con los dias visibles; agregar callback para navegar al dia de emision del invitado |


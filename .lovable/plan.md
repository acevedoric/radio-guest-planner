

## Ajustar transparencia de días pasados en vista MES

Cambio simple: en `src/components/MonthView.tsx`, cambiar `opacity-20` a `opacity-70` para los días pasados, así el contenido sigue siendo legible pero visualmente diferenciado.

### Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/MonthView.tsx` | Cambiar `opacity-20` → `opacity-70` en la clase condicional de días pasados |


# Terminar: Propuestos muestra la fecha ya asignada

El cálculo de la fecha efectiva y el nuevo orden cronológico ya quedaron aplicados en `src/components/ProposedView.tsx`. Falta solo la parte visual de la tarjeta, que todavía muestra "Sin fecha asignada" aunque el invitado tenga día y hora de emisión.

## Qué falta

En cada tarjeta de la bandeja de PROPUESTOS:

- Si tiene fecha de grabación: "Grabación: 25 ago 2026".
- Si no la tiene pero ya está ubicado en el calendario: "Emisión: 16 sep 2026" (fecha calculada desde la semana y el día).
- "Sin fecha asignada" solo cuando no exista ninguna de las dos.
- La línea "Programado: Miércoles · 2ª hora" se mantiene como complemento.
- El botón dirá "Ver / editar fecha" cuando ya haya fecha y "Asignar fecha" cuando no (en modo presentación sigue diciendo "Ver detalles").

## Detalle técnico

- Único archivo: `src/components/ProposedView.tsx`, bloque de render de la tarjeta (líneas ~112-163), usando el helper `getEffectiveDate` ya existente.
- Sin cambios de base de datos ni de lógica de guardado.

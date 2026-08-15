# Propuestos: mostrar la fecha ya asignada

## Problema confirmado

Los invitados creados como PROPUESTO desde las vistas DÍA / SEMANA / MES sí quedan con día y hora de emisión (`week_date` + `day_of_week` + `time_slot`), pero no con "fecha de grabación". La bandeja de PROPUESTOS solo mira ese campo de grabación, así que muestra "Sin fecha asignada" aunque el invitado ya esté ubicado en el calendario.

Ejemplos reales en la base: Alexander Vega (miércoles de la semana del 14 sep, 2ª hora), Tulio Zuloaga (miércoles 14 sep, 1ª hora), Carolina Ospina (lunes 7 sep, 2ª hora) — todos sin fecha de grabación.

## Solución

En la tarjeta de la bandeja de PROPUESTOS, calcular la fecha real a partir de la semana + día de la semana cuando no haya fecha de grabación:

- Si hay fecha de grabación, se sigue mostrando esa (etiqueta "Grabación").
- Si no la hay pero el invitado ya tiene semana y día, mostrar esa fecha calculada con la etiqueta "Emisión" (por ejemplo "Emisión: 16 sep 2026 · Miércoles · 2ª hora").
- Solo se muestra "Sin fecha asignada" cuando el invitado realmente no tiene ninguna de las dos.

El orden de la bandeja pasa a usar esa fecha efectiva (grabación o emisión), cronológicamente, dejando al final los que no tienen ninguna fecha.

El botón inferior dirá "Ver / editar fecha" cuando ya exista una fecha, y "Asignar fecha" cuando no.

## Detalles técnicos

- Solo se modifica `src/components/ProposedView.tsx`.
- La fecha se deriva con `addDays(parseISO(week_date), offset)` según `day_of_week` (lunes=0 … jueves=3), usando date-fns en zona local (nunca `toISOString`).
- No hay cambios de base de datos ni de lógica de guardado.

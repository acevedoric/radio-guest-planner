# Orden cronológico de las franjas de grabación/propuestos

Hoy las tiras superiores de cada día se muestran en dos bloques separados: primero todas las grabaciones (rojas) y debajo todos los propuestos (azules). Por eso "Prop: 16:00" aparece después de "Grab: 17:00".

## Qué se cambia

- Fusionar grabaciones y propuestos en una sola lista por día, ordenada por hora ascendente (los que no tienen hora van al final).
- Conservar los colores y etiquetas actuales: rojo con 🔴 "Grab:" para to_record/postponed, azul con 🔵 "Prop:" para propuestos.
- Aplicar el mismo criterio en la vista SEMANA y en la vista MES (donde también se pintan dos bloques separados).

## Detalle técnico

- `src/components/WeeklyCalendar.tsx`: combinar `getRecordingsForDay` y `getProposedForDay` en una función que devuelva el arreglo unificado ordenado por `scheduled_time`, y renderizar una sola pasada aplicando estilo según `recording_status`.
- `src/components/MonthView.tsx`: mismo cambio con `getScheduledRecordingsForDay` / `getProposedForDay`; el cálculo de altura de fila pasa a usar el máximo de la lista combinada.
- Sin cambios de datos ni de lógica de negocio.

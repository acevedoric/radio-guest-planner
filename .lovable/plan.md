# Cargo en la misma línea del nombre

Objetivo: ahorrar espacio vertical en las tarjetas de invitado poniendo el cargo justo al lado del nombre, de modo que los slots se vean más rectangulares (anchos y bajos) en vez de cuadrados.

## Cambios visuales

- **Vista SEMANA** (`WeeklyCalendar.tsx`): nombre y `(cargo)` en un mismo renglón flex, el nombre truncado y el cargo en texto pequeño gris que se recorta si no cabe. Aplica a la tarjeta principal, al co-invitado y al overlay de arrastre.
- **Vista MES** (`MonthView.tsx`): el cargo deja de ser una línea propia debajo del nombre y pasa a la misma línea, separado por `·`, con truncado.
- **Vista DÍA** (`DayView.tsx`): el cargo ya va al lado del nombre; se ajusta el bloque de la línea 342-352 para que quede en un solo renglón con truncado.

## Altura de las tarjetas

- Se reduce el `min-h-[140px]` de las tarjetas de semana a una altura menor (aprox. 110px) para que el bloque quede más rectangular al liberar el renglón del cargo.

Solo son cambios de presentación: no se toca la lógica de datos, estados ni el guardado.

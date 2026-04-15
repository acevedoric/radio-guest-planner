

## Plan: Exportar Libreto a Word (Martes/Jueves)

### Resumen

Agregar un botón "Exportar Libreto" en la Vista Día (solo Martes y Jueves) que genera un documento Word (.docx) usando los moldes como plantilla, reemplazando todas las instrucciones en `[corchetes]` con la información real de los invitados almacenada en la base de datos.

### Mapeo de placeholders → campos de la BD

| Placeholder en el molde | Campo en la BD | Hora |
|---|---|---|
| `[DIA]`, `[MES]`, `[AÑO]` | Calculado desde `selectedDayDate` | Global |
| `[INVITADO]` | `guest.name` | H1 |
| `[Cargo]` | `guest.position` | H1 |
| `[twitter]`, `[instagram]` | `guest.social_networks` | H1/H2/H3 |
| `[TEMA PRINCIPAL]` | `guest.tema_principal` | H1 |
| `[INFANCIA Y VIDA PRIVADA]` | `guest.infancia_vida_privada` | H1 |
| `[CARRERA ARTISTICA O PROFESIONAL]` | `guest.carrera_profesional` | H1 |
| `[DATOS CURIOSOS]` | `guest.datos_curiosos` | H1 |
| `[PREGUNTA DE LA ENCUESTA]` | `guest.encuesta_pregunta` | H1 (ancla) |
| Canciones / Clips | `guest.h1_canciones` | H1 |
| `[TEMA SEGUNDA HORA]` | `guest_h2.topic` | H2 |
| Contexto H2 | `guest_h2.h2_contexto` | H2 |
| `[PREGUNTAS SUGERIDAS]` | `guest_h2.h2_preguntas_sugeridas` | H2 |
| `[INVITADO SEGUNDA HORA]` | `guest_h2.name` + `position` | H2 |
| `guest_h2.h2_info_personal` | Info personal H2 | H2 |
| Canciones H2 | `guest_h2.h2_canciones` | H2 |
| Avance H2 / H3 | `guest.avance_h2`, `guest.avance_h3` | H1/H2 |
| `[INVITADO TERCERA HORA]` | `guest_h3.name` | H3 |
| `[TEMA DE LA TERCERA HORA]` | `guest_h3.topic` | H3 |
| `[DATOS PERSONALES]` | `guest_h3.h3_datos_personales` | H3 |
| `[COMUNICADO DE PRENSA]` | `guest_h3.h3_comunicado_prensa` | H3 |
| Canciones H3 | `guest_h3.h3_canciones` | H3 |

### Implementación

**1. Script generador de Word** — Un script Node.js usando `docx-js` que construye el documento siguiendo la estructura exacta de los moldes (Martes o Jueves), insertando los datos reales de los 3 invitados del día.

**2. Botón en DayView** — Un botón "Exportar Libreto" visible solo en Martes y Jueves, que:
- Toma los 3 guests del día seleccionado
- Genera el .docx en el cliente usando `docx` (librería npm)
- Descarga automáticamente el archivo con nombre tipo `MARTES_15_DE_ABRIL_DE_2026.docx`

**3. Lógica condicional por día:**
- **Martes**: H1 usa "Canciones", H2 es "Puerta al Universo", hashtag `#PuertaAlUniversoBlaBlaBLU`
- **Jueves**: H1 usa "Clips de comediante", H2 es "#TBT", hashtag `#tbtBlaBlaBLU`

### Archivos a modificar/crear

| Archivo | Cambio |
|---|---|
| `package.json` | Agregar dependencia `docx` y `file-saver` |
| `src/components/LibretoExport.tsx` | Nuevo componente con la lógica de generación del Word |
| `src/components/DayView.tsx` | Agregar botón "Exportar Libreto" (solo Mar/Jue) |

### Detalle técnico

El documento se genera 100% en el cliente (no necesita Edge Function). La librería `docx` crea el archivo en memoria y `file-saver` lo descarga. Si un campo está vacío en la BD, se muestra `[PENDIENTE]` en el documento para que el equipo sepa qué falta completar.


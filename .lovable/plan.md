

## Plan: Redesplegar Edge Function `chat-guests`

### Diagnóstico

Revisé el código y ejecuté pruebas directas contra la Edge Function. El código **ya incluye** correctamente:

- `position.ilike.%${v}%` en el filtro `.or()` (línea 78)
- Variantes de género (`getGenderVariants`) para cada keyword
- El cargo en el contexto enviado a la IA

Las pruebas que hice confirman que funciona — por ejemplo, al preguntar "¿qué escritores han venido?" devuelve resultados con "(Escritor)", "(Escritora)", "(Periodista)", etc.

**El problema probable:** la función desplegada puede estar desactualizada respecto al código actual. 

### Acción

1. **Redesplegar** la Edge Function `chat-guests` para asegurar que la versión en producción sea la correcta
2. **Verificar** con una prueba en vivo que los resultados incluyan el cargo

No se necesitan cambios de código — solo redeploy.


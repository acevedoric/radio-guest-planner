# Batería de regresión del buscador

Corre `busqueda_regresion.sql` dentro de una transacción con `ROLLBACK` al final — no modifica datos ni crea usuarios/roles. Necesita el uuid de una cuenta producer/admin real para que `has_role()`/`auth.uid()` la reconozcan.

En la misma sesión, antes del archivo:

```sql
SELECT set_config('test.producer_uid', '<uuid-de-un-producer-real>', false);
```

Luego:

```sql
\i supabase/tests/busqueda_regresion.sql
```

El resultado final es una tabla con una fila `PASS`/`FAIL` por caso — léela completa, no hay un resumen automático de "todo ok".

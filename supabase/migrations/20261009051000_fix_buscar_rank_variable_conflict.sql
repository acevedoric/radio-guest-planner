DO $d$
DECLARE s text;
BEGIN
  s := pg_get_functiondef('public.buscar_invitados_rank(text,integer)'::regprocedure);
  IF position('#variable_conflict' IN s) = 0 THEN
    s := replace(s, E'AS $function$\n', E'AS $function$\n#variable_conflict use_column\n');
    EXECUTE s;
  END IF;
END
$d$;
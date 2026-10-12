-- FASE Q: cargo condensado a máximo 4 palabras + "perfil" (el cargo
-- original largo/descripción del personaje, guardado en
-- campos_fuente.perfil por el pipeline local -- ver
-- bbb-ingest/lib/cargo_condensado_cache.js). historico_por_rango ahora
-- también devuelve perfil, para mostrarlo en el detalle del histórico
-- (DayView/WeeklyCalendar vía HistoricoSlotCard).

CREATE OR REPLACE FUNCTION public.historico_por_rango(p_desde date, p_hasta date)
RETURNS TABLE (
  fecha date,
  day_of_week text,
  hour_number integer,
  guest_name text,
  cargo text,
  tema text,
  estado_emision text,
  conflicto boolean,
  tiene_libreto boolean,
  libreto_chunk_ids uuid[],
  perfil text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
#variable_conflict use_column
DECLARE
  is_allowed boolean := public.has_role(auth.uid(), 'producer'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'viewer'::app_role);
BEGIN
  IF NOT is_allowed THEN
    RETURN; -- sin filas para roles no autorizados, en vez de error
  END IF;

  RETURN QUERY
  SELECT
    ih.fecha,
    ih.day_of_week,
    ih.hour_number,
    ih.guest_name,
    ih.cargo,
    ih.tema,
    ih.estado_emision,
    ih.conflicto,
    EXISTS (SELECT 1 FROM public.libretos_chunks lc WHERE lc.fecha = ih.fecha AND lc.hour_number = ih.hour_number) AS tiene_libreto,
    (SELECT array_agg(lc.id ORDER BY lc.created_at, lc.id) FROM public.libretos_chunks lc WHERE lc.fecha = ih.fecha AND lc.hour_number = ih.hour_number) AS libreto_chunk_ids,
    ih.campos_fuente->>'perfil' AS perfil
  FROM public.invitados_historicos ih
  WHERE ih.fecha BETWEEN p_desde AND p_hasta
  ORDER BY ih.fecha, ih.hour_number;
END;
$function$;

REVOKE ALL ON FUNCTION public.historico_por_rango(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.historico_por_rango(date, date) TO authenticated;

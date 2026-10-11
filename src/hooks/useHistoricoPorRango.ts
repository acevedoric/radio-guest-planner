import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { HistoricoRow } from "@/types/historico";

/** Filas del histórico (invitados_historicos) para un rango de fechas --
 * para mostrar en la vista semanal/día/titulares cuando no hay guest
 * agendado, o para completar cargo/tema de un guest enlazado. Requiere
 * rol producer/admin/viewer (si no, la RPC devuelve vacío). */
export function useHistoricoPorRango(desde: string | null, hasta: string | null) {
  const [data, setData] = useState<HistoricoRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!desde || !hasta) {
      setData([]);
      return;
    }
    let active = true;
    setLoading(true);
    supabase
      .rpc("historico_por_rango", { p_desde: desde, p_hasta: hasta })
      .then(({ data: rows, error }) => {
        if (!active) return;
        if (error) {
          console.error("Error cargando historico_por_rango:", error);
          setData([]);
        } else {
          setData((rows as HistoricoRow[]) || []);
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [desde, hasta]);

  const byKey = new Map<string, HistoricoRow[]>();
  for (const r of data) {
    const key = `${r.fecha}|${r.hour_number}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(r);
  }

  /** La mejor fila para un slot (fecha+hora): prefiere emitido, luego
   * sin_confirmar, luego planeado_no_emitido (esa última solo se usa si
   * es la única versión disponible). */
  const getFor = (fecha: string, hour: number): HistoricoRow | undefined => {
    const group = byKey.get(`${fecha}|${hour}`);
    if (!group || !group.length) return undefined;
    return (
      group.find((r) => r.estado_emision === "emitido") ||
      group.find((r) => r.estado_emision === "sin_confirmar") ||
      group[0]
    );
  };

  return { historico: data, loading, getFor };
}

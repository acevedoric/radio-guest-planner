export interface HistoricoRow {
  fecha: string;
  day_of_week: string | null;
  hour_number: number;
  guest_name: string;
  cargo: string | null;
  tema: string | null;
  estado_emision: "emitido" | "planeado_no_emitido" | "sin_confirmar";
  conflicto: boolean;
  tiene_libreto: boolean;
  libreto_chunk_ids: string[] | null;
}

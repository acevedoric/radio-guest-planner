import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Herramienta de importación ÚNICA del histórico BBB (PROMOS/GUÍAS/CALENDARIO/
// canciones). No es un flujo recurrente: la app es la fuente de verdad para
// invitados nuevos. Autenticación por header x-ingest-secret (no JWT), pensada
// para ser llamada únicamente desde el script local en bbb-ingest/ (gitignored).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-ingest-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Comparación en tiempo constante para no filtrar el secret por timing. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

function normalizeName(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const DAY_OFFSETS: Record<string, number> = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3 };

/** Fecha de emisión (YYYY-MM-DD) a partir de week_date + day_of_week, igual que src/lib/webhooks.ts. */
function emissionDateFromWeek(weekDate: string | null, dayOfWeek: string | null): string | null {
  if (!weekDate || !dayOfWeek || !(dayOfWeek in DAY_OFFSETS)) return null;
  const [y, m, d] = weekDate.split("-").map(Number);
  const date = new Date(y, m - 1, d + DAY_OFFSETS[dayOfWeek]);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Enlaza un invitado histórico con un guest existente: nombre normalizado
 * (sin tildes/mayúsculas) exacto + fecha de emisión (o scheduled_date)
 * coincidente. Sin fecha no enlaza (evita falsos positivos por homónimos).
 */
async function findGuest(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  name: string | null | undefined,
  fecha: string | null | undefined
): Promise<{ id: string; name: string } | null> {
  if (!name || !fecha) return null;
  const firstWord = name.trim().split(/\s+/)[0];
  if (!firstWord) return null;
  const { data } = await supabase
    .from("guests")
    .select("id, name, week_date, day_of_week, scheduled_date")
    .ilike("name", `%${firstWord}%`)
    .limit(50);
  if (!data) return null;
  const target = normalizeName(name);
  for (const g of data) {
    if (normalizeName(g.name) !== target) continue;
    const emission = emissionDateFromWeek(g.week_date, g.day_of_week);
    if (emission === fecha || g.scheduled_date === fecha) return { id: g.id, name: g.name };
  }
  return null;
}

const InvitadoHistoricoRow = z.object({
  fecha: z.string().nullable().optional(),
  day_of_week: z.enum(["monday", "tuesday", "wednesday", "thursday"]).nullable().optional(),
  hour_number: z.number().int().min(1).max(3).nullable().optional(),
  guest_name: z.string().min(1),
  tema: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  // Texto de prensa/contacto cortado del nombre por el parser local
  // (lib/normalize.js: cutPrensaFromName) — se conserva para auditoría, no
  // se usa para nada dentro de la app.
  prensa_raw: z.string().nullable().optional(),
  // guest_id NO se recibe del cliente: se calcula aquí abajo (findGuestId),
  // porque solo esta función tiene SUPABASE_SERVICE_ROLE_KEY. El script
  // local no debe tener esa key.
});

const LibretoChunkRow = z.object({
  guest_name: z.string().nullable().optional(),
  guest_role: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),
  day_of_week: z.enum(["monday", "tuesday", "wednesday", "thursday"]).nullable().optional(),
  hour_number: z.number().int().min(1).max(3).nullable().optional(),
  fecha: z.string().nullable().optional(),
  content: z.string().min(1),
  // true cuando el documento fuente tiene revisiones sin limpiar para el
  // mismo (fecha, hora) con invitados distintos y ninguna fuente externa
  // (CALENDARIO/PROMOS) permitió decidir cuál es la vigente: se cargan
  // todas las versiones en disputa en vez de adivinar.
  conflicto: z.boolean().optional().default(false),
  conflicto_nota: z.string().nullable().optional(),
});

const CancionRow = z.object({
  titulo: z.string().min(1),
  artista: z.string().nullable().optional(),
  anio: z.number().int().nullable().optional(),
  catalogo: z.enum(["90s", "en_vivo", "otros"]).default("otros"),
  es_cortinilla: z.boolean().default(false),
});

const CancionUsoRow = z.object({
  cancion_titulo: z.string().min(1),
  cancion_artista: z.string().nullable().optional(),
  fecha: z.string().nullable().optional(),
  day_of_week: z.string().nullable().optional(),
  hour_number: z.number().int().nullable().optional(),
  segmento: z.string().nullable().optional(),
});

const CancionSegmentoRow = z.object({
  cancion_titulo: z.string().min(1),
  cancion_artista: z.string().nullable().optional(),
  segmento: z.string().min(1),
  day_of_week: z.string().nullable().optional(),
  hour_number: z.number().int().nullable().optional(),
  es_firma: z.boolean().default(false),
});

const DELETABLE_KINDS = ["invitados_historicos", "libretos_chunks", "canciones_uso"] as const;

const PayloadSchema = z.object({
  kind: z.enum(["invitados_historicos", "libretos_chunks", "canciones", "canciones_uso", "cancion_segmento"]),
  source_file: z.string().min(1).max(300).optional(),
  mode: z.enum(["replace", "append", "delete"]).default("replace"),
  // rows no es obligatorio en mode="delete" (solo borra, no inserta nada).
  rows: z.array(z.record(z.unknown())).max(2000).default([]),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const expectedSecret = Deno.env.get("INGEST_SECRET");
    if (!expectedSecret) {
      console.error("INGEST_SECRET secret not configured");
      return json({ error: "Ingest secret not configured" }, 500);
    }
    const providedSecret = req.headers.get("x-ingest-secret") ?? "";
    if (!safeEqual(providedSecret, expectedSecret)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const rawPayload = await req.json();
    const parsed = PayloadSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return json({ error: "Invalid input", details: parsed.error.issues }, 400);
    }
    const { kind, source_file, mode, rows } = parsed.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Borrado explícito (p.ej. "borra 2025 antes de recargar"): solo
    // elimina, no inserta. Se identifica por source_file (nombre del
    // documento de ese año: "GUÍA DE CONTENIDOS 2025.docx", etc.) — las
    // tablas del histórico no tienen otra columna de año confiable para
    // invitados_historicos/libretos_chunks/canciones_uso a la vez.
    if (mode === "delete") {
      if (!source_file) return json({ error: "mode=delete requiere source_file" }, 400);
      if (!(DELETABLE_KINDS as readonly string[]).includes(kind)) {
        return json({ error: `mode=delete no soportado para kind=${kind}` }, 400);
      }
      const { error: delError, count } = await supabase
        .from(kind)
        .delete({ count: "exact" })
        .eq("source_file", source_file);
      if (delError) return json({ error: `delete failed: ${delError.message}` }, 500);
      return json({ ok: true, kind, mode: "delete", source_file, deleted: count ?? 0 });
    }

    if (rows.length === 0) {
      return json({ error: "rows requerido (min 1) salvo en mode=delete" }, 400);
    }

    let inserted = 0;
    const errors: string[] = [];

    if (kind === "invitados_historicos" || kind === "libretos_chunks") {
      if (mode === "replace" && source_file) {
        const { error: delError } = await supabase.from(kind).delete().eq("source_file", source_file);
        if (delError) return json({ error: `delete failed: ${delError.message}` }, 500);
      }

      const schema = kind === "invitados_historicos" ? InvitadoHistoricoRow : LibretoChunkRow;
      const validRows: Record<string, unknown>[] = [];
      let linked = 0;
      const linkedDetails: { historico_name: string; guest_name: string; guest_id: string; fecha: string | null | undefined }[] = [];
      for (const [i, row] of rows.entries()) {
        const r = schema.safeParse(row);
        if (!r.success) {
          errors.push(`row ${i}: ${JSON.stringify(r.error.issues)}`);
          continue;
        }
        const built: Record<string, unknown> = { ...r.data, source_file: source_file ?? null };
        if (kind === "invitados_historicos") {
          const data = r.data as z.infer<typeof InvitadoHistoricoRow>;
          const match = await findGuest(supabase, data.guest_name, data.fecha);
          built.guest_id = match?.id ?? null;
          if (match) {
            linked++;
            linkedDetails.push({ historico_name: data.guest_name, guest_name: match.name, guest_id: match.id, fecha: data.fecha });
          }
        } else if (kind === "libretos_chunks") {
          // guest_name es NOT NULL en la tabla; algunos bloques (sin línea
          // "Invitado:"/"Programa con:") llegan sin nombre identificable.
          built.guest_name = (built.guest_name as string | null) ?? "";
        }
        validRows.push(built);
      }
      if (validRows.length > 0) {
        const { error: insError, count } = await supabase.from(kind).insert(validRows, { count: "exact" });
        if (insError) return json({ error: `insert failed: ${insError.message}`, parse_errors: errors }, 500);
        inserted = count ?? validRows.length;
      }
      if (kind === "invitados_historicos") {
        return json({ ok: true, kind, inserted, linked, linked_details: linkedDetails, total: rows.length, errors: errors.slice(0, 20) });
      }
    } else if (kind === "canciones") {
      for (const [i, row] of rows.entries()) {
        const r = CancionRow.safeParse(row);
        if (!r.success) {
          errors.push(`row ${i}: ${JSON.stringify(r.error.issues)}`);
          continue;
        }
        const { data, error } = await supabase.rpc("upsert_cancion", {
          p_titulo: r.data.titulo,
          p_artista: r.data.artista ?? null,
          p_anio: r.data.anio ?? null,
          p_catalogo: r.data.catalogo,
          p_es_cortinilla: r.data.es_cortinilla,
        });
        if (error) errors.push(`row ${i}: ${error.message}`);
        else if (data) inserted++;
      }
    } else if (kind === "canciones_uso") {
      if (mode === "replace" && source_file) {
        const { error: delError } = await supabase.from("canciones_uso").delete().eq("source_file", source_file);
        if (delError) return json({ error: `delete failed: ${delError.message}` }, 500);
      }
      for (const [i, row] of rows.entries()) {
        const r = CancionUsoRow.safeParse(row);
        if (!r.success) {
          errors.push(`row ${i}: ${JSON.stringify(r.error.issues)}`);
          continue;
        }
        const { data: cancionId, error: upsertError } = await supabase.rpc("upsert_cancion", {
          p_titulo: r.data.cancion_titulo,
          p_artista: r.data.cancion_artista ?? null,
        });
        if (upsertError || !cancionId) {
          errors.push(`row ${i}: ${upsertError?.message ?? "no cancion id"}`);
          continue;
        }
        const { error: insError } = await supabase.from("canciones_uso").insert({
          cancion_id: cancionId,
          fecha: r.data.fecha ?? null,
          day_of_week: r.data.day_of_week ?? null,
          hour_number: r.data.hour_number ?? null,
          segmento: r.data.segmento ?? null,
          source_file: source_file ?? null,
        });
        if (insError) errors.push(`row ${i}: ${insError.message}`);
        else inserted++;
      }
    } else if (kind === "cancion_segmento") {
      for (const [i, row] of rows.entries()) {
        const r = CancionSegmentoRow.safeParse(row);
        if (!r.success) {
          errors.push(`row ${i}: ${JSON.stringify(r.error.issues)}`);
          continue;
        }
        const { data: cancionId, error: upsertError } = await supabase.rpc("upsert_cancion", {
          p_titulo: r.data.cancion_titulo,
          p_artista: r.data.cancion_artista ?? null,
        });
        if (upsertError || !cancionId) {
          errors.push(`row ${i}: ${upsertError?.message ?? "no cancion id"}`);
          continue;
        }
        const { error: segError } = await supabase.rpc("upsert_cancion_segmento", {
          p_cancion_id: cancionId,
          p_segmento: r.data.segmento,
          p_day_of_week: r.data.day_of_week ?? null,
          p_hour_number: r.data.hour_number ?? null,
          p_es_firma: r.data.es_firma,
        });
        if (segError) errors.push(`row ${i}: ${segError.message}`);
        else inserted++;
      }
    }

    return json({ ok: true, kind, inserted, total: rows.length, errors: errors.slice(0, 20) });
  } catch (e) {
    console.error("ingest-libreto error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

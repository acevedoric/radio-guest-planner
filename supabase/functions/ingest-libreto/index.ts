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

// FASE P: "cargo basura" importado de Excel (excel_import) -- frases de
// promo/invitaci\u00f3n pegadas por error en la celda de cargo, no un cargo
// real. Nunca se usa para "la app manda" -- se trata como vac\u00edo.
const GARBAGE_CARGO_PHRASE_RE = /\b(quiero|invitar|invitarlos|invitarles|saluda|amigos de|despu[e\u00e9]s de|esta noche|buenas noches|a las|llamar|confirmar|pendiente)\b/i;
const GARBAGE_CARGO_TIME_RE = /\b\d{1,2}(:\d{2})?\s*(a\.?\s*m\.?|p\.?\s*m\.?)\b|\b\d{1,2}\s*de\s*la\s*(noche|tarde|ma[\u00f1n]ana)\b|\b\d{1,2}:\d{2}\b/i;
const CARGO_PROFESSION_RE = /\b(periodista|presentador|presentadora|actor|actriz|cantante|m[u\u00fa]sic[oa]|chef|m[e\u00e9]dic[oa]|abogad[oa]|comediante|escritor|escritora|astr[o\u00f3]nom[oa]|psic[o\u00f3]log[oa]|deportista|futbolista|ciclista|empresari[oa]|influencer|productor|productora|director|directora|docente|investigador|investigadora)\b/i;
const KNOWN_TEAM_FIRST_NAMES = new Set(["mauricio", "simon"]);
function looksLikeGarbageCargo(cargo: string | null | undefined): boolean {
  if (!cargo) return false;
  const c = cargo.trim();
  if (!c) return false;
  if (KNOWN_TEAM_FIRST_NAMES.has(normalizeName(c))) return true;
  if (CARGO_PROFESSION_RE.test(c)) return false;
  if (GARBAGE_CARGO_PHRASE_RE.test(c)) return true;
  if (GARBAGE_CARGO_TIME_RE.test(c)) return true;
  if (c.length > 80) return true;
  return false;
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
 * Enlaza un invitado histórico con un guest existente. Dos reglas, en este
 * orden (la primera que encuentre algo gana):
 * 1. Nombre normalizado (sin tildes/mayúsculas) EXACTO + fecha de emisión
 *    (o scheduled_date) coincidente.
 * 2. Nombre normalizado CONTENIDO uno dentro del otro (en cualquier
 *    dirección, p.ej. "Ezequiel López" ⊂ "Ezequiel López Peralta") +
 *    fecha Y hora coincidentes (hour_number == time_slot) — la hora se
 *    exige aquí porque el match ya no es exacto, para no enlazar
 *    homónimos/coincidencias parciales por casualidad. El nombre más
 *    corto de los dos debe tener al menos 2 palabras (evita que un solo
 *    nombre de pila común enganche a cualquiera que lo contenga).
 * Sin fecha no enlaza en ningún caso (evita falsos positivos).
 */
async function findGuest(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  name: string | null | undefined,
  fecha: string | null | undefined,
  hourNumber: number | null | undefined
): Promise<{ id: string; name: string; method: "exact" | "contains"; position: string | null; topic: string | null; notes: string | null; proposed_by: string | null } | null> {
  if (!name || !fecha) return null;
  const firstWord = name.trim().split(/\s+/)[0];
  if (!firstWord) return null;
  const { data } = await supabase
    .from("guests")
    .select("id, name, week_date, day_of_week, scheduled_date, time_slot, position, topic, notes, proposed_by")
    .ilike("name", `%${firstWord}%`)
    .limit(50);
  if (!data) return null;
  const target = normalizeName(name);

  const dateMatches = (g: any): boolean => {
    const emission = emissionDateFromWeek(g.week_date, g.day_of_week);
    return emission === fecha || g.scheduled_date === fecha;
  };

  for (const g of data) {
    if (normalizeName(g.name) === target && dateMatches(g)) {
      return { id: g.id, name: g.name, method: "exact", position: g.position ?? null, topic: g.topic ?? null, notes: g.notes ?? null, proposed_by: g.proposed_by ?? null };
    }
  }

  if (hourNumber != null) {
    for (const g of data) {
      const gNorm = normalizeName(g.name);
      const shorter = gNorm.length <= target.length ? gNorm : target;
      if (shorter.trim().split(/\s+/).length < 2) continue;
      const contains = target.includes(gNorm) || gNorm.includes(target);
      if (contains && dateMatches(g) && g.time_slot === hourNumber) {
        return { id: g.id, name: g.name, method: "contains", position: g.position ?? null, topic: g.topic ?? null, notes: g.notes ?? null, proposed_by: g.proposed_by ?? null };
      }
    }
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
  // Cargo/ocupación/agrupación cortado del nombre en la primera coma
  // ("Miguel González, actor" -> cargo="actor").
  cargo: z.string().nullable().optional(),
  // true cuando la fila viene de un bloque "GRABA" (grabación anticipada)
  // fusionado con su fila de emisión real, O cuando la fecha es festivo en
  // Colombia (festivos_co.js) — el programa de un festivo siempre se graba
  // la semana anterior, aunque no haya fila "GRABA" explícita.
  grabado_con_anticipacion: z.boolean().optional().default(false),
  // true cuando el documento fuente tiene revisiones sin limpiar para el
  // mismo (fecha, hora) con invitados distintos y ninguna fuente externa
  // (CALENDARIO/PROMOS) permitió decidir cuál es la vigente -- mismo
  // convenio que libretos_chunks (FASE M: antes se incrustaba como texto
  // "[CONFLICTO sin resolver — ...]" dentro de `tema`, ya no).
  conflicto: z.boolean().optional().default(false),
  conflicto_nota: z.string().nullable().optional(),
  // FASE N: estado de la fila frente a lo que realmente salió al aire,
  // validado contra la nota "programa completo" de bluradio.com (ver
  // bbb-ingest/lib/bluradio_validator.js) -- 'planeado_no_emitido' se
  // excluye de ranking/conteos/apariciones/invitados_por_fecha, pero NO se
  // borra (su libreto queda asociado por si la persona vuelve).
  estado_emision: z.enum(["emitido", "planeado_no_emitido", "sin_confirmar"]).optional().default("sin_confirmar"),
  fuente_validacion: z.string().nullable().optional(),
  // FASE N (llenado de vacíos): copy del promo, fragmento de la nota web
  // que corresponde a esta persona, y de qué fuente salió cada campo
  // llenado ({"cargo":"web","tema":"promo"}) -- ver bbb-ingest/lib/fill_gaps.js.
  promo_copy: z.string().nullable().optional(),
  resumen_web: z.string().nullable().optional(),
  campos_fuente: z.record(z.string()).nullable().optional(),
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
  // FASE R: solo "Consolidado Canciones 90s.xlsx" trae género real; el
  // resto llega 'otro' desde bbb-ingest/parse_canciones.js.
  genero: z.enum(["anglo", "español", "tropical", "salsa", "otro"]).default("otro"),
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
  mode: z.enum(["replace", "append", "delete", "relink_check"]).default("replace"),
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

    // Solo lectura: calcula qué filas enlazarían con guests (findGuest, con
    // la nueva regla de nombre contenido + fecha/hora) SIN insertar ni
    // modificar nada — para medir el impacto de un cambio de regla de
    // enlace antes de decidir recargar.
    if (mode === "relink_check") {
      if (kind !== "invitados_historicos") {
        return json({ error: "mode=relink_check solo soportado para kind=invitados_historicos" }, 400);
      }
      const linkedDetails: { historico_name: string; guest_name: string; guest_id: string; fecha: string | null | undefined; method: string }[] = [];
      const relinkErrors: string[] = [];
      for (const [i, row] of rows.entries()) {
        const r = InvitadoHistoricoRow.safeParse(row);
        if (!r.success) {
          relinkErrors.push(`row ${i}: ${JSON.stringify(r.error.issues)}`);
          continue;
        }
        const match = await findGuest(supabase, r.data.guest_name, r.data.fecha, r.data.hour_number);
        if (match) {
          linkedDetails.push({ historico_name: r.data.guest_name, guest_name: match.name, guest_id: match.id, fecha: r.data.fecha, method: match.method });
        }
      }
      return json({
        ok: true,
        kind,
        mode: "relink_check",
        total: rows.length,
        linked: linkedDetails.length,
        linked_exact: linkedDetails.filter((l) => l.method === "exact").length,
        linked_contains: linkedDetails.filter((l) => l.method === "contains").length,
        linked_details: linkedDetails,
        errors: relinkErrors.slice(0, 20),
      });
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
      const linkedDetails: { historico_name: string; guest_name: string; guest_id: string; fecha: string | null | undefined; method: string }[] = [];
      // FASE Q: contadores para el reporte de carga (ver bbb-ingest/load_old_years.js).
      let cargosDeApp = 0;
      let temasDeApp = 0;
      let cargosCondensados = 0;
      let cargosVacios = 0;
      let guestsRellenados = 0;
      for (const [i, row] of rows.entries()) {
        const r = schema.safeParse(row);
        if (!r.success) {
          errors.push(`row ${i}: ${JSON.stringify(r.error.issues)}`);
          continue;
        }
        const built: Record<string, unknown> = { ...r.data, source_file: source_file ?? null };
        if (kind === "invitados_historicos") {
          const data = r.data as z.infer<typeof InvitadoHistoricoRow>;
          const match = await findGuest(supabase, data.guest_name, data.fecha, data.hour_number);
          built.guest_id = match?.id ?? null;
          if (match) {
            linked++;
            linkedDetails.push({ historico_name: data.guest_name, guest_name: match.name, guest_id: match.id, fecha: data.fecha, method: match.method });

            // FASE Q: prioridad de cargo cuando la fila está enlazada a un
            // guest -- "cargo de la app (si es corto) > condensado > vacío".
            // El cliente ya condensó el cargo local a <=4 palabras (ver
            // bbb-ingest/lib/cargo_condensado_cache.js), así que ya no se
            // protege un cargo "de GUÍA" por sí solo: el de la app manda
            // mientras sea corto (<=4 palabras) y no sea basura de Excel.
            // El tema conserva la regla anterior (FASE O): no se
            // sobrescribe un tema que ya vino de GUÍA directamente.
            const camposFuente = (built.campos_fuente as Record<string, string> | null) ?? {};
            const temaEsDeGuia = !!data.tema && !camposFuente.tema;
            const cargoAppEsBasura = match.proposed_by === "excel_import" && looksLikeGarbageCargo(match.position);
            const cargoAppEsCorto = !!match.position && match.position.trim().split(/\s+/).filter(Boolean).length <= 4;
            if (match.position && !cargoAppEsBasura && cargoAppEsCorto) {
              built.cargo = match.position;
              camposFuente.cargo = "app";
            }
            if (match.topic && !temaEsDeGuia) {
              built.tema = match.topic;
              camposFuente.tema = "app";
            }
            if (Object.keys(camposFuente).length > 0) built.campos_fuente = camposFuente;

            if (camposFuente.cargo === "app") cargosDeApp++;
            if (camposFuente.tema === "app") temasDeApp++;

            // FASE Q: la agenda (guests) se completa SOLO en los campos que
            // el guest tiene vacíos, desde el histórico ya enlazado -- NUNCA
            // sobrescribe nada que el guest ya tenga (cargo condensado,
            // tema, perfil como notas adicionales).
            const guestUpdates: Record<string, unknown> = {};
            if (!match.position && built.cargo) guestUpdates.position = built.cargo;
            if (!match.topic && built.tema) guestUpdates.topic = built.tema;
            if (!match.notes && camposFuente.perfil) guestUpdates.notes = camposFuente.perfil;
            if (Object.keys(guestUpdates).length > 0) {
              const { error: guestUpdateError } = await supabase.from("guests").update(guestUpdates).eq("id", match.id);
              if (!guestUpdateError) guestsRellenados++;
            }
          }
        } else if (kind === "libretos_chunks") {
          // guest_name es NOT NULL en la tabla; algunos bloques (sin línea
          // "Invitado:"/"Programa con:") llegan sin nombre identificable.
          built.guest_name = (built.guest_name as string | null) ?? "";
        }
        if (kind === "invitados_historicos") {
          const perfil = (built.campos_fuente as Record<string, string> | null)?.perfil;
          if (perfil) {
            if (built.cargo) cargosCondensados++;
            else cargosVacios++;
          }
        }
        validRows.push(built);
      }
      if (validRows.length > 0) {
        const { error: insError, count } = await supabase.from(kind).insert(validRows, { count: "exact" });
        if (insError) return json({ error: `insert failed: ${insError.message}`, parse_errors: errors }, 500);
        inserted = count ?? validRows.length;
      }
      if (kind === "invitados_historicos") {
        return json({
          ok: true,
          kind,
          inserted,
          linked,
          linked_details: linkedDetails,
          total: rows.length,
          errors: errors.slice(0, 20),
          cargos_de_app: cargosDeApp,
          temas_de_app: temasDeApp,
          cargos_condensados: cargosCondensados,
          cargos_vacios: cargosVacios,
          guests_rellenados: guestsRellenados,
        });
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
          p_genero: r.data.genero,
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

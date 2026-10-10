import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Modo de preguntas con 3 herramientas deterministas (nunca se le pide al
// LLM que cuente filas de contexto):
// 1. buscar_invitados_rank: cubre agenda (guests) + histórico
//    (invitados_historicos) + guion (libretos_chunks, contexto cualitativo
//    vía source="libreto") en una sola función ya unificada.
// 2. contar_invitados: ÚNICA fuente de verdad para preguntas de cantidad
//    ("¿cuántos...?") — cuenta personas distintas por cargo/tema, sin
//    duplicar entre guests e invitados_historicos.
// Ambas se llaman con el cliente autenticado del usuario (no service role)
// para que has_role(auth.uid(), ...) dentro de esas funciones SECURITY
// DEFINER reconozca correctamente si es producer/admin.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STOPWORDS = new Set([
  "que","qué","cual","cuál","cuales","cuáles","quien","quién","quienes","quiénes",
  "como","cómo","cuando","cuándo","donde","dónde","por","para","con","sin","los","las",
  "una","unas","unos","del","sus","muy","más","mas","menos","pero","sino",
  "hay","ser","son","fue","fueron","era","eran","está","esta","estan","están","estamos",
  "estoy","tengo","tenemos","tienen","tiene","tener","tuvo","todo","toda","todos","todas",
  "este","esto","ese","esa","eso","esos","esas","aquel","aquella",
  "sobre","entre","también","tambien","además","ademas","cada","alguna","alguno","algunos","algunas",
  "ningun","ningún","ninguna","programado","programada","programados","programadas",
  "invitado","invitada","invitados","invitadas","invitar","semana","semanas","mes","meses",
  "día","dia","días","dias","hoy","mañana","manana","ayer","próximo","proximo","próxima","proxima",
  "pasado","pasada","viene","fecha","fechas","programa","programas","han","hemos",
  "estará","estara","estarán","estaran","va","van","vamos","ir",
  "favor","puedes","puede","podrías","podrias","decir","dame","dime","muestra","muéstrame","muestrame",
  "buscar","busca","necesito","quiero","quisiera","cuántos","cuantos","cuántas","cuantas","cuanto","cuánto",
  "invitamos","tuvimos","tuvimos","en","el","la","de","y","a",
]);

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

// buscar_invitados_rank ahora devuelve day_of_week en español (migración
// FASE E) — se reconoce el día dicho por el usuario directamente en español,
// sin traducir a inglés.
const SPANISH_DAYS = new Set(["lunes", "martes", "miércoles", "miercoles", "jueves"]);
const CUANTO_RE = /\bcu[áa]nt[oa]s?\b/i;
const RANKING_RE = /\b(m[áa]s veces|m[áa]s frecuente|qui[ée]n(?:\s+ha)?\s+(?:venido|estado|aparecido)\s+m[áa]s|con m[áa]s apariciones|ranking)\b/i;
// Herramienta apariciones_invitado: "cuántas veces vino X", "cuándo vino X", "historial de X".
const APARICIONES_RE = /\b(cu[áa]nt[ao]s?\s+veces\s+(?:ha\s+)?vin[oi]|cu[áa]ndo\s+(?:vino|estuvo|ha\s+venido)|historial\s+de)\b/i;
// Herramienta invitados_por_fecha: "¿quién vino el 13 de febrero de 2025 en la primera hora?".
const FULL_DATE_RE = /(\d{1,2})\s+de\s+([a-záéíóúñ]+)(?:\s+de\s+(\d{4}))?/i;
const HORA_RE = /\b(primera|segunda|tercera)\s+hora\b/i;
const HORA_NUM: Record<string, number> = { primera: 1, segunda: 2, tercera: 3 };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { question } = await req.json();
    if (!question || typeof question !== "string" || question.length < 3 || question.length > 500) {
      return new Response(JSON.stringify({ error: "Pregunta inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawWords = question
      .replace(/[^a-záéíóúüñA-ZÁÉÍÓÚÜÑ0-9\s]/g, " ")
      .split(/\s+/)
      .map((w: string) => w.toLowerCase().trim())
      .filter(Boolean);

    let monthFilter: number | null = null;
    let dayFilter: string | null = null;
    for (const w of rawWords) {
      if (monthFilter === null && MONTHS[w] !== undefined) monthFilter = MONTHS[w];
      if (dayFilter === null && SPANISH_DAYS.has(w)) dayFilter = w === "miercoles" ? "miércoles" : w;
    }

    // Año explícito ("2025") o relativo ("este año"/"año pasado"/"próximo
    // año") -- SIEMPRE se detecta aquí, en el servidor, antes de llamar a
    // las RPC. No se le pide al modelo que calcule fechas: si una pregunta
    // de cantidad/ranking no fija p_desde/p_hasta, las funciones cuentan
    // TODOS los años (bug real: "más frecuente de 2025" devolvía el total
    // histórico completo, no solo 2025).
    const now = new Date();
    let yearFilter: number | null = null;
    const explicitYearMatch = question.match(/\b(20\d{2})\b/);
    if (explicitYearMatch) {
      yearFilter = parseInt(explicitYearMatch[1], 10);
    } else if (/\b(este\s+a[ñn]o|presente\s+a[ñn]o)\b/i.test(question)) {
      yearFilter = now.getFullYear();
    } else if (/\b(a[ñn]o\s+pasado|el\s+a[ñn]o\s+anterior)\b/i.test(question)) {
      yearFilter = now.getFullYear() - 1;
    } else if (/\b(a[ñn]o\s+que\s+viene|pr[óo]ximo\s+a[ñn]o|a[ñn]o\s+siguiente)\b/i.test(question)) {
      yearFilter = now.getFullYear() + 1;
    }

    const keywords = Array.from(new Set(
      rawWords.filter(
        (w: string) =>
          w.length >= 3 &&
          !STOPWORDS.has(w) &&
          MONTHS[w] === undefined &&
          !SPANISH_DAYS.has(w) &&
          !/^20\d{2}$/.test(w),
      ),
    )).slice(0, 6) as string[];

    let dateRange: { from: string; to: string } | null = null;
    if (monthFilter !== null) {
      let year = yearFilter;
      if (year === null) {
        year = now.getFullYear();
        if (monthFilter < now.getMonth() + 1) year += 1;
      }
      const from = `${year}-${String(monthFilter).padStart(2, "0")}-01`;
      const lastDay = new Date(year, monthFilter, 0).getDate();
      const to = `${year}-${String(monthFilter).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      dateRange = { from, to };
    } else if (yearFilter !== null) {
      dateRange = { from: `${yearFilter}-01-01`, to: `${yearFilter}-12-31` };
    }

    const isQuantityQuestion = CUANTO_RE.test(question);

    const getGenderVariants = (word: string): string[] => {
      const variants = [word];
      if (word.endsWith("ora")) variants.push(word.slice(0, -1));
      else if (word.endsWith("era")) variants.push(word.slice(0, -1));
      else if (word.endsWith("ero")) variants.push(word.slice(0, -1) + "a");
      else if (word.endsWith("a") && word.length > 3) variants.push(word.slice(0, -1) + "o");
      else if (word.endsWith("o") && word.length > 3) variants.push(word.slice(0, -1) + "a");
      return variants;
    };

    // --- Herramienta 1 (y 3): buscar_invitados_rank ---
    // Cubre agenda + histórico + fragmentos de guion en una sola llamada por
    // palabra clave (ya incluye accent-insensitive + full-text + trigram).
    const resultMap = new Map<string, any>();
    // Con 2+ palabras clave, se busca PRIMERO la frase completa (así
    // buscar_invitados_rank exige las DOS como AND real) — buscar cada
    // palabra suelta por separado (p.ej. "miguel" y "gonzalez" cada una
    // sola) deja pasar cualquier fragmento que mencione una sin la otra,
    // que es como "Miguel González" traía ruido de otros invitados que
    // solo comparten una de las dos palabras. Solo si la frase completa no
    // encuentra nada se recurre a las palabras sueltas (gender variants
    // incluidas) para no perder preguntas temáticas de una sola palabra.
    const joinedTerm = keywords.length > 1 ? keywords.join(" ") : null;
    const terms = joinedTerm ? [joinedTerm] : keywords.length ? keywords.flatMap(getGenderVariants) : [question];
    for (const term of terms) {
      const { data, error } = await userClient.rpc("buscar_invitados_rank", { query_text: term, max_results: 20 });
      if (error) continue;
      for (const row of data || []) {
        const key = `${row.source}-${row.id}`;
        if (!resultMap.has(key)) resultMap.set(key, row);
      }
    }
    if (joinedTerm && resultMap.size === 0) {
      for (const term of keywords.flatMap(getGenderVariants)) {
        const { data, error } = await userClient.rpc("buscar_invitados_rank", { query_text: term, max_results: 20 });
        if (error) continue;
        for (const row of data || []) {
          const key = `${row.source}-${row.id}`;
          if (!resultMap.has(key)) resultMap.set(key, row);
        }
      }
    }
    // buscar_invitados_rank ya resuelve la unión "+ histórico" (columna
    // tiene_historico en la fila de agenda) y la distinción propio/mención
    // (columna tipo) -- no hace falta deduplicar de nuevo aquí.
    let results = Array.from(resultMap.values());

    if (dateRange) {
      results = results.filter((r) => r.scheduled_date && r.scheduled_date >= dateRange!.from && r.scheduled_date <= dateRange!.to);
    }
    if (dayFilter) {
      results = results.filter((r) => r.day_of_week === dayFilter);
    }

    // Si hay filtros de fecha/día pero ningún resultado de palabra clave
    // (p.ej. "¿quién está en mayo?"), no hay un tool genérico de "listar por
    // fecha" — se deja vacío y el LLM responde que no encontró coincidencias
    // en vez de inventar, en lugar de recurrir a un listado sin filtrar por
    // palabra clave (eso sí podría inducir a "contar desde chunks").

    // --- Herramienta 2: contar_invitados (única fuente para cantidades) ---
    // apariciones ahora es UNA FILA POR PERSONA ({nombre, fechas: [...]}),
    // por lo que total siempre es exactamente igual a la cantidad de
    // elementos de apariciones — no puede haber más nombres listados que
    // el total, ni menos.
    let officialCount: { total: number; apariciones: { nombre: string; fechas: string[] }[] } | null = null;
    if (isQuantityQuestion) {
      const term = keywords.join(" ") || question;
      const { data, error } = await userClient.rpc("contar_invitados", {
        p_texto: term,
        p_desde: dateRange?.from ?? null,
        p_hasta: dateRange?.to ?? null,
      });
      if (!error && data && data[0]) {
        officialCount = { total: data[0].total, apariciones: data[0].apariciones || [] };
      }
    }

    // --- Herramienta 4: ranking_invitados ("¿quién ha venido más veces?") ---
    let ranking: { nombre: string; apariciones: number; dia_mas_frecuente: string | null; hora_mas_frecuente: number | null }[] | null = null;
    if (RANKING_RE.test(question)) {
      const { data, error } = await userClient.rpc("ranking_invitados", {
        p_desde: dateRange?.from ?? null,
        p_hasta: dateRange?.to ?? null,
        p_limite: 10,
      });
      if (!error && data) ranking = data;
    }

    // --- Herramienta 5: apariciones_invitado ("cuántas veces vino X / cuándo vino X / historial de X") ---
    let apariciones: { nombre: string; fecha: string; dia: string | null; hora: number | null; tema: string | null; fuente: string }[] | null = null;
    if (APARICIONES_RE.test(question) && keywords.length) {
      const { data, error } = await userClient.rpc("apariciones_invitado", {
        p_nombre: keywords.join(" "),
        p_desde: dateRange?.from ?? null,
        p_hasta: dateRange?.to ?? null,
      });
      if (!error && data) apariciones = data;
    }

    // --- Herramienta 6: invitados_por_fecha ("¿quién vino el 13 de febrero de 2025 en la primera hora?") ---
    let porFecha: { nombre: string; hora: number | null; cargo: string | null; tema: string | null; fuente: string; snippet: string | null }[] | null = null;
    const fullDateMatch = question.match(FULL_DATE_RE);
    if (fullDateMatch) {
      const day = parseInt(fullDateMatch[1], 10);
      const monthWord = fullDateMatch[2].toLowerCase();
      const month = MONTHS[monthWord];
      const now = new Date();
      let year = fullDateMatch[3] ? parseInt(fullDateMatch[3], 10) : now.getFullYear();
      if (month !== undefined) {
        const p_fecha = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const horaMatch = question.match(HORA_RE);
        const p_hora = horaMatch ? HORA_NUM[horaMatch[1].toLowerCase()] : null;
        const { data, error } = await userClient.rpc("invitados_por_fecha", { p_fecha, p_hora });
        if (!error && data) porFecha = data;
      }
    }

    const sourceLabels: Record<string, string> = { app: "Agenda", historico: "Histórico", libreto: "Guion (fragmento)" };

    const formatRow = (r: any) => {
      const label = r.tipo === "mencion" ? `Mención en el libreto de ${r.name}` : r.name;
      const histTag = r.tiene_historico ? " [+histórico]" : "";
      return `[${sourceLabels[r.source] || r.source}] ${label}${histTag}${r.guest_position ? ` (${r.guest_position})` : ""} | Tema: ${r.topic || "-"} | ${r.day_of_week || "-"} ${r.scheduled_date || ""} | Hora ${r.time_slot ?? "-"}${r.snippet ? ` | Fragmento: ${r.snippet}` : ""}`;
    };

    const contextLines = results.slice(0, 50).map(formatRow);
    const guestContext = contextLines.join("\n") || "(sin coincidencias)";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("Missing API configuration");

    const today = new Date().toISOString().split("T")[0];

    const filterSummary = [
      yearFilter ? `año=${yearFilter}` : null,
      monthFilter ? `mes=${monthFilter}` : null,
      dayFilter ? `día=${dayFilter}` : null,
      keywords.length ? `palabras_clave=[${keywords.join(", ")}]` : null,
    ].filter(Boolean).join(" | ") || "ninguno";

    const countBlock = officialCount
      ? `CONTEO OFICIAL (de contar_invitados, única fuente válida para cantidades): total=${officialCount.total} persona(s) distinta(s). Lista EXACTA de nombres (uno por persona, con sus fechas de aparición) — no agregues ni quites ninguno: ${JSON.stringify(officialCount.apariciones)}`
      : isQuantityQuestion
        ? "CONTEO OFICIAL: no se pudo calcular (sin resultados de contar_invitados)."
        : null;

    const rankingBlock = ranking
      ? `RANKING OFICIAL (de ranking_invitados, única fuente válida para "quién ha venido más veces"): ${JSON.stringify(ranking)}`
      : RANKING_RE.test(question)
        ? "RANKING OFICIAL: no se pudo calcular (sin resultados de ranking_invitados)."
        : null;

    const aparicionesBlock = apariciones
      ? `HISTORIAL OFICIAL (de apariciones_invitado, única fuente válida para "cuántas veces/cuándo vino X"): ${apariciones.length} aparición(es): ${JSON.stringify(apariciones)}`
      : APARICIONES_RE.test(question)
        ? "HISTORIAL OFICIAL: no se encontraron apariciones de esa persona."
        : null;

    const porFechaBlock = porFecha
      ? `QUIÉN OFICIAL (de invitados_por_fecha, única fuente válida para "quién vino el <fecha>"): ${JSON.stringify(porFecha)}`
      : fullDateMatch
        ? "QUIÉN OFICIAL: no se encontró nadie para esa fecha/hora."
        : null;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Eres un asistente de un programa de radio/TV. Respondes preguntas sobre invitados (agendados, histórico y guiones). La fecha de hoy es ${today}. Responde de forma concisa en español. Los días de emisión son de lunes a jueves.

REGLAS DE CONSISTENCIA (MUY IMPORTANTE):
- NUNCA cuentes filas de "Invitados disponibles" para responder una pregunta de cantidad. Si hay un bloque "CONTEO OFICIAL", ESE es el único número válido, y su lista de nombres es la ÚNICA lista válida — repite el total tal cual y lista EXACTAMENTE esos nombres (ni uno más, ni uno menos; si alguien aparece varias fechas, es la MISMA persona, menciónala una sola vez con sus fechas).
- Si la pregunta es de cantidad y no hay bloque "CONTEO OFICIAL" con total, dilo explícitamente en vez de contar filas del contexto.
- Si la pregunta es sobre quién ha venido más veces/con más frecuencia y hay un bloque "RANKING OFICIAL", ESA es la única fuente válida — no la recalcules contando filas.
- Si hay un bloque "HISTORIAL OFICIAL" (cuántas veces/cuándo vino alguien), responde SOLO con esas apariciones — no agregues ni quites fechas, no mezcles con otras filas de "Invitados disponibles".
- Si hay un bloque "QUIÉN OFICIAL" (quién vino tal fecha/hora), responde SOLO con esos nombres — nunca agregues a nadie más del contexto, aunque aparezca en "Invitados disponibles".
- REGLA GENERAL ANTI-RUIDO: responde SOLO lo que se pregunta, con los datos de la herramienta oficial correspondiente (CONTEO/RANKING/HISTORIAL/QUIÉN) cuando exista. Está PROHIBIDO mencionar un invitado de la Agenda que no sea necesario para responder la pregunta solo porque aparece en la lista "Invitados disponibles" — esa lista es contexto de búsqueda, no una lista para recitar completa.
- Las filas [Guion (fragmento)] son fragmentos de texto para contexto cualitativo (qué se dijo, de qué se habló) — NUNCA las uses para contar personas, pueden repetir al mismo invitado varias veces (un chunk por fragmento del guion). Una fila marcada "Mención en el libreto de X" NO es una aparición propia de la persona buscada — es el libreto de X mencionándola; no la cuentes como si X fuera quien se buscó, y no mezcles sus datos con los de la persona buscada.
- Una fila con "[+histórico]" ya representa a la misma persona en agenda e histórico combinados — no la cuentes ni la menciones dos veces.
- Las filas [Agenda] y [Histórico] son registros de invitados individuales.
- No hagas distinción de género en profesiones para decidir relevancia ("actor"/"actriz", "escritor"/"escritora", etc. son la misma categoría).
- Si no hay filas relevantes ni conteo/ranking/historial/quién oficial, dilo claramente en lugar de inventar.
- Incluye fecha, día y cargo/profesión cuando estén disponibles.
- Puedes usar **negrita** en Markdown para resaltar nombres o números; el formato se renderiza correctamente.

FORMATO DE ENLACES: cuando menciones un invitado de la Agenda con su fecha, usa: [[nombre|day_of_week_en_ingles|week_date]]. Ejemplo: [[Carlos Vives|tuesday|2025-04-08]]. Para invitados de Histórico/Guion no agregues ese formato de enlace (no son editables en la agenda).`,
          },
          {
            role: "user",
            content: `Filtros detectados: ${filterSummary}
${countBlock ? `\n${countBlock}\n` : ""}${rankingBlock ? `\n${rankingBlock}\n` : ""}${aparicionesBlock ? `\n${aparicionesBlock}\n` : ""}${porFechaBlock ? `\n${porFechaBlock}\n` : ""}
Invitados disponibles:
${guestContext}

Pregunta del usuario: ${question}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Demasiadas solicitudes, intenta de nuevo en un momento." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI service error");
    }

    const aiData = await aiResponse.json();
    const answer = aiData.choices?.[0]?.message?.content || "No pude generar una respuesta.";

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-guests error:", e);
    return new Response(JSON.stringify({ error: "Error al procesar la pregunta" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

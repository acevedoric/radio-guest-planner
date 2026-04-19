import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Spanish stopwords + noise words that pollute keyword search
const STOPWORDS = new Set([
  "que","qué","cual","cuál","cuales","cuáles","quien","quién","quienes","quiénes",
  "como","cómo","cuando","cuándo","donde","dónde","por","para","con","sin","los","las",
  "una","unas","unos","del","las","sus","sus","muy","más","mas","menos","pero","sino",
  "hay","ser","son","fue","fueron","era","eran","está","esta","estan","están","estamos",
  "estoy","tengo","tenemos","tienen","tiene","tener","tuvo","todo","toda","todos","todas",
  "este","esta","esto","ese","esa","eso","esos","esas","aquel","aquella",
  "sobre","entre","también","tambien","además","ademas","cada","alguna","alguno","algunos","algunas",
  "ningun","ningún","ninguna","programado","programada","programados","programadas",
  "invitado","invitada","invitados","invitadas","invitar","semana","semanas","mes","meses",
  "día","dia","días","dias","hoy","mañana","manana","ayer","próximo","proximo","próxima","proxima",
  "pasado","pasada","viene","fecha","fechas","programa","programas","han","hemos","han",
  "estará","estara","estarán","estaran","va","van","vamos","ir","tiene","tienen",
  "favor","puedes","puede","podrías","podrias","decir","dame","dime","muestra","muéstrame","muestrame",
  "buscar","busca","necesito","quiero","quisiera","cuántos","cuantos","cuántas","cuantas","cuanto","cuánto",
]);

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const DAYS: Record<string, string> = {
  lunes: "monday", martes: "tuesday", miércoles: "wednesday", miercoles: "wednesday", jueves: "thursday",
};

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

    // Tokenize
    const rawWords = question
      .replace(/[^a-záéíóúüñA-ZÁÉÍÓÚÜÑ0-9\s]/g, " ")
      .split(/\s+/)
      .map((w) => w.toLowerCase().trim())
      .filter(Boolean);

    // Detect filters: month / day-of-week
    let monthFilter: number | null = null;
    let dayFilter: string | null = null;
    for (const w of rawWords) {
      if (monthFilter === null && MONTHS[w] !== undefined) monthFilter = MONTHS[w];
      if (dayFilter === null && DAYS[w] !== undefined) dayFilter = DAYS[w];
    }

    // Meaningful keywords: drop stopwords, month/day names, short tokens
    const keywords = Array.from(new Set(
      rawWords.filter(
        (w) =>
          w.length >= 3 &&
          !STOPWORDS.has(w) &&
          MONTHS[w] === undefined &&
          DAYS[w] === undefined,
      ),
    )).slice(0, 8);

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const getGenderVariants = (word: string): string[] => {
      const variants = [word];
      if (word.endsWith("ora")) variants.push(word.slice(0, -1));
      else if (word.endsWith("or")) variants.push(word + "a");
      else if (word.endsWith("era")) variants.push(word.slice(0, -1));
      else if (word.endsWith("ero")) variants.push(word.slice(0, -1) + "a");
      else if (word.endsWith("ista")) {}
      else if (word.endsWith("a") && word.length > 3) variants.push(word.slice(0, -1) + "o");
      else if (word.endsWith("o") && word.length > 3) variants.push(word.slice(0, -1) + "a");
      return variants;
    };

    // Compute date range from monthFilter (current year, or next year if month already passed by >1mo)
    let dateRange: { from: string; to: string } | null = null;
    if (monthFilter !== null) {
      const now = new Date();
      let year = now.getFullYear();
      // If the month is more than one month in the past, assume next year
      if (monthFilter < now.getMonth() - 0) {
        // month index (1-12) vs now.getMonth() (0-11)
        if (monthFilter < now.getMonth() + 1 - 1) year += 1;
      }
      const from = `${year}-${String(monthFilter).padStart(2, "0")}-01`;
      const lastDay = new Date(year, monthFilter, 0).getDate();
      const to = `${year}-${String(monthFilter).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      dateRange = { from, to };
    }

    // Search per keyword (all of them, capped at 8)
    const matchMap = new Map<string, { row: any; reasons: Set<string> }>();

    const applyFilters = (q: any) => {
      if (dateRange) q = q.gte("week_date", dateRange.from).lte("week_date", dateRange.to);
      if (dayFilter) q = q.eq("day_of_week", dayFilter);
      return q;
    };

    for (const word of keywords) {
      const sanitized = word.replace(/[^a-záéíóúüñ0-9]/g, "");
      if (!sanitized || sanitized.length < 3) continue;

      const variants = getGenderVariants(sanitized);
      const orFilters = variants
        .flatMap((v) => [
          `name.ilike.%${v}%`,
          `topic.ilike.%${v}%`,
          `position.ilike.%${v}%`,
          `press_contact.ilike.%${v}%`,
        ])
        .join(",");

      let query = supabase
        .from("guests")
        .select("name, position, topic, day_of_week, week_date, time_slot, recording_status, press_contact, scheduled_date, proposed_by")
        .or(orFilters)
        .order("week_date", { ascending: false })
        .limit(30);
      query = applyFilters(query);

      const { data } = await query;
      if (!data) continue;

      for (const row of data) {
        const key = `${row.name}-${row.week_date}-${row.day_of_week}-${row.time_slot}`;
        const existing = matchMap.get(key);
        const reasons = existing?.reasons ?? new Set<string>();
        // Determine which field matched
        const lcName = (row.name || "").toLowerCase();
        const lcTopic = (row.topic || "").toLowerCase();
        const lcPos = (row.position || "").toLowerCase();
        const lcPress = (row.press_contact || "").toLowerCase();
        for (const v of variants) {
          if (lcName.includes(v)) reasons.add(`name=${word}`);
          if (lcPos.includes(v)) reasons.add(`position=${word}`);
          if (lcTopic.includes(v)) reasons.add(`topic=${word}`);
          if (lcPress.includes(v)) reasons.add(`press=${word}`);
        }
        matchMap.set(key, { row, reasons });
      }
    }

    // If filters but no keywords (e.g. "¿quién está en mayo?"), pull rows by date/day filter alone
    if (matchMap.size === 0 && (dateRange || dayFilter)) {
      let q = supabase
        .from("guests")
        .select("name, position, topic, day_of_week, week_date, time_slot, recording_status, press_contact, scheduled_date, proposed_by")
        .order("week_date", { ascending: true })
        .limit(60);
      q = applyFilters(q);
      const { data } = await q;
      if (data) {
        for (const row of data) {
          const key = `${row.name}-${row.week_date}-${row.day_of_week}-${row.time_slot}`;
          matchMap.set(key, { row, reasons: new Set([dateRange ? "date" : "day"]) });
        }
      }
    }

    const matches = Array.from(matchMap.values());

    // Fallback: only if no matches AT ALL, show recent guests so the LLM can still answer generic questions
    let recent: any[] = [];
    if (matches.length === 0) {
      const { data } = await supabase
        .from("guests")
        .select("name, position, topic, day_of_week, week_date, time_slot, recording_status, press_contact")
        .order("week_date", { ascending: false })
        .limit(40);
      recent = data || [];
    }

    const dayLabels: Record<string, string> = {
      monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles", thursday: "Jueves",
    };

    const formatRow = (g: any, tag: string) =>
      `${tag} ${g.name}${g.position ? ` (${g.position})` : ""} | Tema: ${g.topic} | ${dayLabels[g.day_of_week] || g.day_of_week} ${g.week_date} | Hora ${g.time_slot} | Estado: ${g.recording_status}${g.press_contact ? ` | Prensa: ${g.press_contact}` : ""}`;

    const matchLines = matches
      .slice(0, 60)
      .map((m) => formatRow(m.row, `[match:${Array.from(m.reasons).join(",") || "keyword"}]`));
    const recentLines = recent.slice(0, 40).map((g) => formatRow(g, "[recent]"));
    const guestContext = [...matchLines, ...recentLines].join("\n") || "(sin invitados encontrados)";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("Missing API configuration");

    const today = new Date().toISOString().split("T")[0];

    const filterSummary = [
      monthFilter ? `mes=${monthFilter}` : null,
      dayFilter ? `día=${dayFilter}` : null,
      keywords.length ? `palabras_clave=[${keywords.join(", ")}]` : null,
    ].filter(Boolean).join(" | ") || "ninguno";

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
            content: `Eres un asistente de un programa de TV. Respondes preguntas sobre los invitados programados. La fecha de hoy es ${today}. Responde de forma concisa y útil en español. Los días de emisión son de lunes a jueves.

REGLAS DE CONSISTENCIA (MUY IMPORTANTE):
- Cada fila viene etiquetada: [match:...] = coincide con la búsqueda; [recent] = solo contexto reciente.
- Si la pregunta menciona una categoría/profesión (actor, cantante, chef, escritor, periodista, etc.), responde SOLO con filas [match] cuya posición/cargo o tema coincida. IGNORA las [recent] salvo que la pregunta sea totalmente genérica ("¿qué invitados hay?").
- No hagas distinción de género: "actor" incluye "actriz", "escritor" incluye "escritora", etc.
- Si la pregunta menciona un mes o día específico, ya está filtrado: enumera todas las filas [match] de ese período.
- El mismo invitado debe aparecer si se busca por nombre suelto ("Carlos") o dentro de una pregunta larga ("¿qué dijiste de Carlos esta semana?"). Sé consistente.
- Si no hay filas [match] relevantes, dilo claramente en lugar de inventar.
- Incluye siempre fecha, día, hora y cargo/profesión cuando estén disponibles.

FORMATO DE ENLACES: Cuando menciones un invitado con su fecha, usa: [[nombre|day_of_week|week_date]]. Ejemplo: [[Carlos Vives|tuesday|2025-04-08]]. day_of_week en inglés (monday, tuesday, wednesday, thursday); week_date en YYYY-MM-DD (lunes de esa semana).`,
          },
          {
            role: "user",
            content: `Filtros detectados: ${filterSummary}

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

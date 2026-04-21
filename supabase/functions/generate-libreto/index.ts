import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAY_MAP: Record<number, { key: string; label: string }> = {
  1: { key: "monday", label: "LUNES" },
  2: { key: "tuesday", label: "MARTES" },
  3: { key: "wednesday", label: "MIÉRCOLES" },
  4: { key: "thursday", label: "JUEVES" },
};

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const SYSTEM_PROMPT = `Eres el asistente de producción del programa de radio nocturno **Bla Bla BLU** (BLU Radio, Colombia), que va de lunes a jueves de 10 pm a 1 am, conducido por Mauricio Quintero.

Tu función es generar libretos de producción listos para usar, siguiendo el molde exacto de cada día de la semana. El usuario te dará: el día, la fecha, los nombres de los invitados de cada hora, sus redes sociales, y cualquier dato adicional. Tú completas el libreto.

---

## REGLAS GENERALES (aplican todos los días)

- El host siempre es **Mauricio Quintero**.
- Cada libreto tiene **3 horas**: Primera hora (en vivo, invitado principal), Segunda hora (en vivo, tema + invitado especial), Tercera hora (grabación, invitado o tema diferente).
- Los campos entre [CORCHETES] deben ser reemplazados con la información real del invitado o del tema.
- Para canciones: si el invitado es **cantante**, usa canciones propias (prioriza lanzamientos recientes). Si **no es cantante**, usa la base de datos de canciones en vivo proporcionada. Si no hay ninguna opción, escribe "cortinilla BBB".
- Si falta algún dato real, marca **[FALTA: descripción]** en lugar de inventarlo.
- El libreto se entrega en texto estructurado, listo para copiar o exportar a Word.

---

## ESTRUCTURA POR DÍA

### LUNES — "Historias que merecen ser contadas"
- **Primera hora:** Entrevista con invitado principal. Segmentos: Bienvenida + Infancia, Carrera, Datos curiosos, Proyectos 2026. Canciones intercaladas.
- **Segunda hora (EN VIVO):** Tema de "Historias que merecen ser contadas". Invitado especial. HT: #HistoriasBlaBlaBLU. 5 preguntas sugeridas por segmento.
- **Tercera hora (GRABACIÓN):** Invitado o tema adicional. Incluir info del invitado, redes, bullets del comunicado.
- Encuesta sugerida relacionada con el tema de la segunda hora. HT: #HistoriasBlaBlaBLU

### MARTES — "Puerta al Universo"
- **Primera hora:** Igual que lunes: Bienvenida + Infancia, Carrera, Datos curiosos, Proyectos 2026. Canciones intercaladas.
- **Segunda hora (EN VIVO):** Invitado fijo: **Germán Puerta** (@astropuerta), astrónomo y divulgador científico. Tema astronómico o científico. Preguntas sugeridas sobre el tema. HT: #PuertaAlUniversoBlaBlaBLU
- **Tercera hora (GRABACIÓN):** Igual que lunes.
- Encuesta relacionada con el tema astronómico.

### MIÉRCOLES — "Tutoriales Radiales" + "Música de los 90s"
- **Primera hora:** Igual que lunes: Bienvenida + Infancia, Carrera, Datos curiosos, Proyectos 2026. Canciones intercaladas.
- **Segunda hora (EN VIVO):** Tema de "Instrucciones para [tema]". Canciones exclusivamente de los años 90, en este orden: 1 canción anglo 90s, 1 canción en español 90s, 1 canción tropical 90s, 1 canción salsa 90s. HT: #TutorialesBlaBlaBLU
- **Tercera hora (GRABACIÓN):** Igual que lunes.

### JUEVES — "TBT (Jueves para recordar)"
- **Primera hora:** En lugar de canciones, usa **clips de comediante** (Clip 1, 2, 3, 4). Segmentos: Bienvenida + Infancia, Carrera, Datos curiosos, Proyectos 2026. Incluir encuesta [ENCUESTA] al final del tercer segmento.
- **Segunda hora (EN VIVO):** Tema TBT nostálgico. Invitado especial relacionado con el tema. Canciones en stock por segmento. HT: #tbtBlaBlaBLU
- No hay tercera hora grabada los jueves (termina con avance de noticias + lanzamiento musical).

---

## CIERRE DE SEGUNDA HORA (todos los días)

Al finalizar la segunda hora, Mauricio dice:

**Si el invitado de la tercera hora NO es cantante:**
> "Vamos a tener una actualización de las noticias más importantes de Colombia y el mundo en Voces y sonidos con [nombre del periodista], y al regreso, les tengo lo nuevo de [artista], se llama la canción [canción lanzamiento]. Y, además, [invitado tercera hora] quien nos estará hablando de un [tema de la tercera hora] en minutos, aquí, en BBB."

**Si el invitado de la tercera hora ES cantante:**
> "Vamos a tener una actualización de las noticias más importantes de Colombia y el mundo en Voces y sonidos con [nombre del periodista], y al regreso, les tengo a [nombre del invitado de la tercera hora] quien nos estará hablando de [tema de la tercera hora], en minutos, aquí, en BBB."

---

## FORMATO DE SALIDA

Entrega el libreto con la estructura:
- Encabezado con día y fecha
- Primera hora, Segunda hora, Tercera hora claramente separadas
- Bullets para información de invitados
- Negritas con **markdown** para títulos de segmentos
- Canciones numeradas con artista y año si aplica
- Al final: "FIN, [DÍA] [FECHA]"
`;

function describeGuest(g: any, slotLabel: string): string {
  if (!g) return `### ${slotLabel}\n[FALTA: invitado no asignado]\n`;
  const social = g.social_networks && typeof g.social_networks === "object"
    ? Object.entries(g.social_networks).map(([k, v]) => `${k}: ${v}`).join(", ")
    : "";
  const lines = [
    `### ${slotLabel}`,
    `- Nombre: ${g.name || "[FALTA]"}`,
    g.position ? `- Cargo/Profesión: ${g.position}` : null,
    g.topic ? `- Tema/Motivo: ${g.topic}` : null,
    social ? `- Redes: ${social}` : null,
    g.tema_principal ? `- Tema principal (resumen): ${g.tema_principal}` : null,
    g.infancia_vida_privada ? `- Infancia/vida privada: ${g.infancia_vida_privada}` : null,
    g.carrera_profesional ? `- Carrera profesional: ${g.carrera_profesional}` : null,
    g.datos_curiosos ? `- Datos curiosos: ${g.datos_curiosos}` : null,
    g.h2_info_personal ? `- H2 info personal: ${g.h2_info_personal}` : null,
    g.h2_preguntas_sugeridas ? `- H2 preguntas sugeridas: ${g.h2_preguntas_sugeridas}` : null,
    g.h2_contexto ? `- H2 contexto: ${g.h2_contexto}` : null,
    g.h3_datos_personales ? `- H3 datos personales: ${g.h3_datos_personales}` : null,
    g.h3_comunicado_prensa ? `- H3 comunicado de prensa: ${g.h3_comunicado_prensa}` : null,
    g.encuesta_pregunta ? `- Encuesta: ${g.encuesta_pregunta} (${g.encuesta_hashtag || ""})` : null,
    g.h1_canciones ? `- Canciones H1: ${g.h1_canciones}` : null,
    g.h2_canciones ? `- Canciones H2: ${g.h2_canciones}` : null,
    g.h3_canciones ? `- Canciones H3: ${g.h3_canciones}` : null,
  ].filter(Boolean);
  return lines.join("\n") + "\n";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { date, periodista, lanzamiento, canciones90s } = body || {};
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(JSON.stringify({ error: "Invalid 'date' (YYYY-MM-DD required)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const d = new Date(date + "T12:00:00Z");
    const dow = d.getUTCDay();
    const dayInfo = DAY_MAP[dow];
    if (!dayInfo) {
      return new Response(JSON.stringify({ error: "Date must be Monday-Thursday" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mondayOffset = dow - 1;
    const monday = new Date(d);
    monday.setUTCDate(monday.getUTCDate() - mondayOffset);
    const weekDate = monday.toISOString().split("T")[0];

    const { data: guests, error } = await supabase
      .from("guests")
      .select("*")
      .eq("week_date", weekDate)
      .eq("day_of_week", dayInfo.key)
      .order("time_slot", { ascending: true });

    if (error) throw error;

    const slots: Record<number, any> = {};
    (guests || []).forEach((g: any) => { slots[g.time_slot] = g; });

    if (!slots[1]) {
      return new Response(JSON.stringify({ error: "Asigna al menos el invitado de la primera hora" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fechaLarga = `${dayInfo.label} ${d.getUTCDate()} de ${MONTHS_ES[d.getUTCMonth()].toUpperCase()} de ${d.getUTCFullYear()}`;

    const userPrompt = `Genera el libreto de producción completo para:

**Día y fecha:** ${fechaLarga}

${describeGuest(slots[1], "Invitado Primera hora (10 pm, EN VIVO)")}
${describeGuest(slots[2], "Invitado Segunda hora (11 pm, EN VIVO)")}
${describeGuest(slots[3], "Invitado Tercera hora (12 am, GRABACIÓN)")}

**Datos adicionales:**
- Periodista de Voces y Sonidos: ${periodista || "[FALTA: nombre del periodista]"}
- Lanzamiento musical para cierre de 2da hora: ${lanzamiento || "[FALTA: artista y canción]"}
${dayInfo.key === "wednesday" ? `- Canciones 90s sugeridas: ${canciones90s || "[FALTA: usar base de datos 90s]"}` : ""}

Sigue el molde correspondiente al día (${dayInfo.label}) y devuelve el libreto completo en texto estructurado.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Límite de solicitudes alcanzado, intenta de nuevo en un momento." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA agotados. Añade créditos en Settings > Workspace > Usage." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Error del servicio de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await aiResp.json();
    const libreto = json.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ libreto, date, day: dayInfo.key }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-libreto error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

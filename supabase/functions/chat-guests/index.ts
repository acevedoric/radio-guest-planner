import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify JWT auth
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

    // Sanitize keywords - remove special characters that could be used for injection
    const words = question
      .replace(/[^a-záéíóúüñA-ZÁÉÍÓÚÜÑ0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .map((w) => w.toLowerCase());

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Generate gender variants for a word (escritora->escritor, actor->actora, etc.)
    const getGenderVariants = (word: string): string[] => {
      const variants = [word];
      if (word.endsWith("ora")) variants.push(word.slice(0, -1)); // escritora -> escritor
      else if (word.endsWith("or")) variants.push(word + "a"); // escritor -> escritora
      else if (word.endsWith("era")) variants.push(word.slice(0, -1)); // enfermera -> enfermero
      else if (word.endsWith("ero")) variants.push(word.slice(0, -1) + "a"); // enfermero -> enfermera
      else if (word.endsWith("ista")) {} // artista - already neutral
      else if (word.endsWith("a") && word.length > 3) variants.push(word.slice(0, -1) + "o");
      else if (word.endsWith("o") && word.length > 3) variants.push(word.slice(0, -1) + "a");
      return variants;
    };

    // Search for guests matching any keyword using sanitized input
    let allGuests: any[] = [];
    for (const word of words.slice(0, 5)) {
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

      const { data } = await supabase
        .from("guests")
        .select("name, position, topic, day_of_week, week_date, time_slot, recording_status, press_contact, scheduled_date, proposed_by")
        .or(orFilters)
        .order("week_date", { ascending: false })
        .limit(20);
      if (data) allGuests.push(...data);
    }

    // Also get recent guests for general context
    const { data: recentGuests } = await supabase
      .from("guests")
      .select("name, position, topic, day_of_week, week_date, time_slot, recording_status")
      .order("week_date", { ascending: false })
      .limit(30);

    // Deduplicate
    const seen = new Set<string>();
    const uniqueGuests = [...allGuests, ...(recentGuests || [])].filter((g) => {
      const key = `${g.name}-${g.week_date}-${g.day_of_week}-${g.time_slot}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const dayLabels: Record<string, string> = {
      monday: "Lunes", tuesday: "Martes", wednesday: "Miércoles", thursday: "Jueves",
    };

    const guestContext = uniqueGuests
      .slice(0, 50)
      .map((g) => `- ${g.name}${g.position ? ` (${g.position})` : ""} | Tema: ${g.topic} | ${dayLabels[g.day_of_week] || g.day_of_week} ${g.week_date} | Hora ${g.time_slot} | Estado: ${g.recording_status}${g.press_contact ? ` | Prensa: ${g.press_contact}` : ""}`)
      .join("\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("Missing API configuration");

    const today = new Date().toISOString().split("T")[0];

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
            content: `Eres un asistente de un programa de TV. Respondes preguntas sobre los invitados programados. La fecha de hoy es ${today}. Responde de forma concisa y útil en español. Si no encuentras información relevante, dilo claramente. Incluye fechas, cargos/profesión y detalles cuando sea posible. Los días de emisión son de lunes a jueves.\n\nIMPORTANTE: No hagas distinción de género en las búsquedas. Si preguntan por "escritor", incluye también "escritora" y viceversa. Muestra siempre el cargo/profesión del invitado cuando esté disponible.\n\nIMPORTANTE: Cuando menciones un invitado junto con su fecha de aparición, usa este formato especial para generar un enlace: [[nombre del invitado|day_of_week|week_date]]. Ejemplo: [[Carlos Vives|tuesday|2025-04-08]] fue invitado para hablar sobre su nuevo álbum. El day_of_week debe ser en inglés (monday, tuesday, wednesday, thursday) y week_date en formato YYYY-MM-DD (el lunes de esa semana).`,
          },
          {
            role: "user",
            content: `Aquí están los invitados registrados:\n${guestContext}\n\nPregunta del usuario: ${question}`,
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

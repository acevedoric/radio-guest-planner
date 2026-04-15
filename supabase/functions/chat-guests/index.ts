import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { question } = await req.json();
    if (!question || typeof question !== "string" || question.length < 3) {
      return new Response(JSON.stringify({ error: "Pregunta inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract potential names/keywords from the question
    const words = question
      .replace(/[¿?.,!]/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .map((w) => w.toLowerCase());

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Search for guests matching any keyword
    let allGuests: any[] = [];
    for (const word of words.slice(0, 5)) {
      const { data } = await supabase
        .from("guests")
        .select("name, position, topic, day_of_week, week_date, time_slot, recording_status, press_contact, scheduled_date, proposed_by")
        .or(`name.ilike.%${word}%,topic.ilike.%${word}%,press_contact.ilike.%${word}%`)
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
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
            content: `Eres un asistente de un programa de TV. Respondes preguntas sobre los invitados programados. La fecha de hoy es ${today}. Responde de forma concisa y útil en español. Si no encuentras información relevante, dilo claramente. Incluye fechas y detalles cuando sea posible. Los días de emisión son de lunes a jueves.\n\nIMPORTANTE: Cuando menciones un invitado junto con su fecha de aparición, usa este formato especial para generar un enlace: [[nombre del invitado|day_of_week|week_date]]. Ejemplo: [[Carlos Vives|tuesday|2025-04-08]] fue invitado para hablar sobre su nuevo álbum. El day_of_week debe ser en inglés (monday, tuesday, wednesday, thursday) y week_date en formato YYYY-MM-DD (el lunes de esa semana).`,
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
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const answer = aiData.choices?.[0]?.message?.content || "No pude generar una respuesta.";

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-guests error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

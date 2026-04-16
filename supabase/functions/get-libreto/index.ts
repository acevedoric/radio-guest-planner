/**
 * GET /get-libreto?date=YYYY-MM-DD
 *
 * Returns the 3 guests for a given day with all libreto-relevant fields.
 * Protected by x-webhook-secret header.
 *
 * Expected fields per guest (slots 1-3):
 *   name, position, topic, social_networks,
 *   tema_principal, infancia_vida_privada, carrera_profesional, datos_curiosos,
 *   encuesta_pregunta, encuesta_hashtag, h1_canciones,
 *   h2_info_personal, h2_preguntas_sugeridas, h2_contexto, h2_canciones,
 *   h3_datos_personales, h3_comunicado_prensa, h3_canciones,
 *   avance_h2, avance_h3
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify webhook secret
  const webhookSecret = req.headers.get("x-webhook-secret");
  const expectedSecret = Deno.env.get("N8N_WEBHOOK_SECRET");
  if (expectedSecret && (!webhookSecret || webhookSecret !== expectedSecret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const date = url.searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response(JSON.stringify({ error: "Missing or invalid 'date' query param (YYYY-MM-DD)" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine day_of_week from date
    const d = new Date(date + "T12:00:00Z");
    const dayMap: Record<number, string> = { 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday" };
    const dayOfWeek = dayMap[d.getUTCDay()];

    if (!dayOfWeek) {
      return new Response(JSON.stringify({ error: "Date must be Monday-Thursday" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the week_date (Monday of that week)
    const mondayOffset = d.getUTCDay() - 1;
    const monday = new Date(d);
    monday.setUTCDate(monday.getUTCDate() - mondayOffset);
    const weekDate = monday.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("guests")
      .select("*")
      .eq("week_date", weekDate)
      .eq("day_of_week", dayOfWeek)
      .order("time_slot", { ascending: true });

    if (error) throw error;

    const slots: Record<number, any> = {};
    (data || []).forEach((g: any) => { slots[g.time_slot] = g; });

    return new Response(JSON.stringify({
      date,
      day_of_week: dayOfWeek,
      week_date: weekDate,
      slots: {
        1: slots[1] || null,
        2: slots[2] || null,
        3: slots[3] || null,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

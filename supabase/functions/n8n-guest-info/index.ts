import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-callback-secret",
};

// Campos que n8n devuelve por hora → columna en public.guests
const HOUR_FIELD_MAP: Record<"H1" | "H2" | "H3", Record<string, string>> = {
  H1: {
    coyuntura: "tema_principal",
    infancia: "infancia_vida_privada",
    carrera: "carrera_profesional",
    curiosidades: "datos_curiosos",
  },
  H2: {
    info_personal: "h2_info_personal",
    preguntas_sugeridas: "h2_preguntas_sugeridas",
  },
  H3: {
    datos_personales: "h3_datos_personales",
    comunicado_prensa: "h3_comunicado_prensa",
  },
};

const HOUR_TIMESTAMP_KEY: Record<"H1" | "H2" | "H3", string> = {
  H1: "n8n_updated_at",
  H2: "h2_n8n_updated_at",
  H3: "h3_n8n_updated_at",
};

const MAX_FIELD_LENGTH = 10000;

const CallbackPayloadSchema = z.object({
  guest_id: z.string().uuid("guest_id must be a valid UUID"),
  hour: z.enum(["H1", "H2", "H3"]),
  status: z.enum(["ok", "error"]),
  fields: z.record(z.string().nullable()).optional().default({}),
  error_message: z.string().max(2000).nullable().optional(),
});

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const expectedSecret = Deno.env.get("N8N_CALLBACK_SECRET");
    if (!expectedSecret) {
      console.error("N8N_CALLBACK_SECRET secret not configured");
      return json({ error: "Callback secret not configured" }, 500);
    }
    const providedSecret = req.headers.get("x-callback-secret") ?? "";
    if (!safeEqual(providedSecret, expectedSecret)) {
      return json({ error: "Unauthorized" }, 401);
    }

    const rawPayload = await req.json();
    const parseResult = CallbackPayloadSchema.safeParse(rawPayload);
    if (!parseResult.success) {
      return json({ error: "Invalid input", details: parseResult.error.issues }, 400);
    }

    const payload = parseResult.data;
    const now = new Date().toISOString();
    console.log(`n8n callback for guest ${payload.guest_id}, ${payload.hour}: ${payload.status}`);

    const updateData: Record<string, string | null> = {
      research_hour: payload.hour,
      research_updated_at: now,
    };

    if (payload.status === "ok") {
      const fieldMap = HOUR_FIELD_MAP[payload.hour];
      for (const [incoming, column] of Object.entries(fieldMap)) {
        const value = payload.fields[incoming];
        if (typeof value === "string") {
          updateData[column] = value.slice(0, MAX_FIELD_LENGTH);
        }
      }
      updateData[HOUR_TIMESTAMP_KEY[payload.hour]] = now;
      updateData.research_status = "done";
      updateData.research_error = null;
    } else {
      updateData.research_status = "error";
      updateData.research_error = payload.error_message?.trim() || "La investigación falló en n8n";
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("guests")
      .update(updateData)
      .eq("id", payload.guest_id)
      .select("id, research_status, research_updated_at")
      .maybeSingle();

    if (error) {
      console.error("Database error:", error);
      return json({ error: "Failed to update guest record" }, 500);
    }
    if (!data) {
      return json({ error: "Guest not found" }, 404);
    }

    return json({
      success: true,
      guest_id: data.id,
      research_status: data.research_status,
      research_updated_at: data.research_updated_at,
    });
  } catch (error: unknown) {
    console.error("Error processing request:", error);
    return json({ error: "Internal server error" }, 500);
  }
});

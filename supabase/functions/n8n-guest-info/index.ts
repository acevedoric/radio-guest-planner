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

// FASE R: bloque de texto fijo que n8n puede mandar en CUALQUIER campo de
// `fields` (no se sabe de antemano en cuál) con este formato:
//   REDES Y CONTACTO:
//   - Instagram: @usuario — 12.3K seguidores
//   - X: @usuario
//   - TikTok: @usuario — 500 seguidores
//   - YouTube: @usuario
//   - Facebook: @usuario
//   - Sitio web: https://...
//   - Contacto profesional: nombre@agencia.com
// Solo rellena lo que el guest tenga vacío -- nunca sobrescribe. El
// correo (si "Contacto profesional" parece uno) NUNCA va a
// guests.email/press_email directo: se ofrece como correo_sugerido.
const REDES_PLATFORM_KEY: Record<string, string> = {
  instagram: "instagram",
  x: "x",
  twitter: "x",
  tiktok: "tiktok",
  youtube: "youtube",
  facebook: "facebook",
  "sitio web": "website",
};
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;

type RedesParsed = {
  // social_networks guarda el handle como string plano (compatible con
  // el formulario de edición manual y el resto del frontend); los
  // seguidores van aparte en social_followers.
  socialHandles: Record<string, string>;
  socialFollowers: Record<string, number>;
  correoDesdeContacto: string | null;
};

/** Busca el bloque "REDES Y CONTACTO" en cualquiera de los fields recibidos y lo parsea línea por línea. */
function parseRedesBlock(fields: Record<string, string | null>): RedesParsed {
  const socialHandles: Record<string, string> = {};
  const socialFollowers: Record<string, number> = {};
  let correoDesdeContacto: string | null = null;

  const blockText = Object.values(fields).find((v) => typeof v === "string" && /REDES\s+Y\s+CONTACTO/i.test(v)) as
    | string
    | undefined;
  if (!blockText) return { socialHandles, socialFollowers, correoDesdeContacto };

  const afterHeader = blockText.slice(blockText.search(/REDES\s+Y\s+CONTACTO/i));
  const lines = afterHeader.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("-"));

  for (const line of lines) {
    const m = line.match(/^-\s*([^:]+):\s*(.+)$/);
    if (!m) continue;
    const label = m[1].trim().toLowerCase();
    const value = m[2].trim();

    if (label === "contacto profesional") {
      const emailMatch = value.match(EMAIL_RE);
      if (emailMatch) correoDesdeContacto = emailMatch[0];
      continue;
    }

    const platform = REDES_PLATFORM_KEY[label];
    if (!platform) continue;

    const [handlePart, followersPart] = value.split(/\s+—\s+/);
    const handle = handlePart.trim();
    if (!handle) continue;
    socialHandles[platform] = handle;
    if (followersPart) {
      const num = followersPart.match(/([\d.,]+)\s*([km]?)/i);
      if (num) {
        let n = parseFloat(num[1].replace(/,/g, ""));
        if (/k/i.test(num[2])) n *= 1000;
        else if (/m/i.test(num[2])) n *= 1000000;
        socialFollowers[platform] = Math.round(n);
      }
    }
  }

  return { socialHandles, socialFollowers, correoDesdeContacto };
}

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // deno-lint-ignore no-explicit-any
    const updateData: Record<string, any> = {
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

      // FASE R: redes y correo sugerido -- solo rellena lo que el guest
      // tiene vacío, nunca sobrescribe.
      const { socialHandles, socialFollowers, correoDesdeContacto } = parseRedesBlock(payload.fields);
      if (Object.keys(socialHandles).length > 0 || correoDesdeContacto) {
        const { data: current } = await supabase
          .from("guests")
          .select("name, social_networks, social_followers, correo_sugerido, press_email")
          .eq("id", payload.guest_id)
          .maybeSingle();

        if (current) {
          const existingSocial = (current.social_networks as Record<string, unknown> | null) ?? {};
          const existingFollowers = (current.social_followers as Record<string, number> | null) ?? {};
          const mergedSocial = { ...existingSocial };
          const mergedFollowers = { ...existingFollowers };
          let socialChanged = false;
          let followersChanged = false;
          for (const [platform, handle] of Object.entries(socialHandles)) {
            if (!existingSocial[platform]) {
              mergedSocial[platform] = handle;
              socialChanged = true;
              if (socialFollowers[platform] !== undefined) {
                mergedFollowers[platform] = socialFollowers[platform];
                followersChanged = true;
              }
            }
          }
          if (socialChanged) updateData.social_networks = mergedSocial;
          if (followersChanged) updateData.social_followers = mergedFollowers;

          if (!current.correo_sugerido) {
            if (correoDesdeContacto) {
              updateData.correo_sugerido = correoDesdeContacto;
              updateData.correo_fuente = "n8n_redes";
            } else if (current.name) {
              // Punto 9: si no vino correo de n8n, ofrece el de un correo
              // de PR de una aparición anterior del mismo invitado.
              const { data: previous } = await supabase
                .from("guests")
                .select("press_email")
                .ilike("name", current.name)
                .neq("id", payload.guest_id)
                .not("press_email", "is", null)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              if (previous?.press_email) {
                updateData.correo_sugerido = previous.press_email;
                updateData.correo_fuente = "invitado_anterior";
              }
            }
          }
        }
      }
    } else {
      updateData.research_status = "error";
      updateData.research_error = payload.error_message?.trim() || "La investigación falló en n8n";
    }

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

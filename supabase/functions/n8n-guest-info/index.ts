import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

const N8nPayloadSchema = z.object({
  guest_id: z.string().uuid("guest_id must be a valid UUID"),
  tema_principal: z.string().max(10000).optional(),
  infancia_vida_privada: z.string().max(10000).optional(),
  carrera_profesional: z.string().max(10000).optional(),
  datos_curiosos: z.string().max(10000).optional(),
});

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify webhook secret
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("N8N_WEBHOOK_SECRET");

    if (expectedSecret && (!webhookSecret || webhookSecret !== expectedSecret)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    const rawPayload = await req.json();
    const parseResult = N8nPayloadSchema.safeParse(rawPayload);

    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parseResult.error.issues }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = parseResult.data;
    console.log("Received validated n8n payload for guest:", payload.guest_id);

    // Create Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build update object with only provided fields
    const updateData: Record<string, string | Date> = {
      n8n_updated_at: new Date().toISOString(),
    };

    if (payload.tema_principal !== undefined) {
      updateData.tema_principal = payload.tema_principal;
    }
    if (payload.infancia_vida_privada !== undefined) {
      updateData.infancia_vida_privada = payload.infancia_vida_privada;
    }
    if (payload.carrera_profesional !== undefined) {
      updateData.carrera_profesional = payload.carrera_profesional;
    }
    if (payload.datos_curiosos !== undefined) {
      updateData.datos_curiosos = payload.datos_curiosos;
    }

    console.log("Updating guest with data:", JSON.stringify(updateData, null, 2));

    // Update the guest record
    const { data, error } = await supabase
      .from("guests")
      .update(updateData)
      .eq("id", payload.guest_id)
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to update guest record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data) {
      return new Response(
        JSON.stringify({ error: "Guest not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Guest updated successfully:", data.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Guest information updated",
        guest_id: data.id,
        updated_at: data.n8n_updated_at
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

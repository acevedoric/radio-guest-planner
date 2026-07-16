import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "search_guests",
  title: "Buscar invitados",
  description:
    "Busca invitados por nombre, tema, cargo o contacto de prensa (búsqueda parcial, sin distinción de mayúsculas).",
  inputSchema: {
    query: z.string().trim().min(2).describe("Texto a buscar (mínimo 2 caracteres)."),
    limit: z.number().int().min(1).max(50).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const q = query.replace(/[%,]/g, " ");
    const { data, error } = await supabaseForUser(ctx)
      .from("guests")
      .select(
        "id, name, position, topic, day_of_week, week_date, time_slot, recording_status, press_contact, scheduled_date",
      )
      .or(
        `name.ilike.%${q}%,topic.ilike.%${q}%,position.ilike.%${q}%,press_contact.ilike.%${q}%`,
      )
      .order("week_date", { ascending: false })
      .limit(limit ?? 25);

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { guests: data ?? [] },
    };
  },
});

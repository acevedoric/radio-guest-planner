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
  name: "list_upcoming_guests",
  title: "Listar próximos invitados",
  description:
    "Lista los invitados programados desde hoy en adelante en el calendario de Bla Bla Blu (lunes a jueves).",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Máximo de invitados a devolver (por defecto 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return {
        content: [{ type: "text", text: "No autenticado" }],
        isError: true,
      };
    }
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabaseForUser(ctx)
      .from("guests")
      .select(
        "id, name, position, topic, day_of_week, week_date, time_slot, recording_status, scheduled_date",
      )
      .gte("week_date", today)
      .order("week_date", { ascending: true })
      .order("time_slot", { ascending: true })
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

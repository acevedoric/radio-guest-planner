import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listUpcomingGuestsTool from "./tools/list-upcoming-guests";
import searchGuestsTool from "./tools/search-guests";
import getGuestTool from "./tools/get-guest";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "bla-bla-blu-mcp",
  title: "Bla Bla Blu MCP",
  version: "0.1.0",
  instructions:
    "Herramientas para consultar el calendario de invitados de Bla Bla Blu (lunes a jueves). Usa 'list_upcoming_guests' para próximos invitados, 'search_guests' para buscar por nombre/tema/cargo, y 'get_guest' para el detalle completo por id.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listUpcomingGuestsTool, searchGuestsTool, getGuestTool],
});

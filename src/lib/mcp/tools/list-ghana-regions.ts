import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_ghana_regions",
  title: "List Ghana's regions",
  description:
    "Reference list of Ghana's sixteen regions with slug, name and capital. The seventeenth region is the diaspora itself and is not a row here.",
  inputSchema: {
    slug: z.string().trim().min(1).optional().describe("Return one region by slug instead of all sixteen."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase.from("ghana_regions").select("*").order("name");
    if (slug) query = query.eq("slug", slug);
    const { data, error } = await query;

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { regions: data ?? [] },
    };
  },
});

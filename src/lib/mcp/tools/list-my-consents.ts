import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_consents",
  title: "List my consents and affirmations",
  description:
    "Read the signed-in member's own consent history (one row per consent, with grant and revocation times and policy version) and their Compact affirmation records. Read only: consent records are append-only and can only be changed in the app.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const [consents, affirmations] = await Promise.all([
      supabase
        .from("member_consents")
        .select("consent_type, granted_at, revoked_at, policy_version, mechanism")
        .order("granted_at", { ascending: false }),
      supabase
        .from("affirmations")
        .select("compact_version, affirmed_at")
        .order("affirmed_at", { ascending: false }),
    ]);

    const error = consents.error ?? affirmations.error;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }

    const payload = { consents: consents.data ?? [], affirmations: affirmations.data ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});

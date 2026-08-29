import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

const NON_STATUS_NOTICE =
  "Region 17 membership is a standing in a community. It is not a government document and confers no citizenship, residence, visa, or right of entry.";

export default defineTool({
  name: "get_my_membership",
  title: "Get my membership record",
  description:
    "Read the signed-in member's own Region 17 record: member number, credential ID, handle, standing dates and status. Returns nothing for a signed-in user who has not yet registered.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("members")
      .select(
        "member_number, credential_id, handle, display_name, country, city, timezone, connection_types, primary_connection, region_interests, joined_at, class_year, founding_member, status, last_affirmed_at",
      )
      .maybeSingle();

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    if (!data) {
      return {
        content: [
          {
            type: "text",
            text: "No membership record for this account yet. Registration happens in the app at /join/register.",
          },
        ],
      };
    }
    return {
      content: [{ type: "text", text: `${JSON.stringify(data, null, 2)}\n\n${NON_STATUS_NOTICE}` }],
      structuredContent: { member: data, notice: NON_STATUS_NOTICE },
    };
  },
});

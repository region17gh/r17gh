import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyMembership from "./tools/get-my-membership";
import listMyConsents from "./tools/list-my-consents";
import listGhanaRegions from "./tools/list-ghana-regions";

// The OAuth issuer must be the direct Supabase host, built from the project ref
// that Vite inlines at build time. The fallback only keeps the issuer well formed
// during the throwaway manifest extraction.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "region-17-ghana-initial-build-aug-2026",
  title: "Region 17 Ghana | Initial Build (Aug 2026)",
  version: "0.1.0",
  instructions:
    "Tools for the Region 17 Ghana membership register. Callers sign in as a member and read only their own records: use get_my_membership for their register entry, list_my_consents for their consent and Compact affirmation history, and list_ghana_regions for the reference list of Ghana's sixteen regions. Everything is read only. Region 17 membership is a standing in a community. It is not a government document and confers no citizenship, residence, visa, or right of entry. Never advise on citizenship, Right of Abode, or Ghana Card eligibility: those route to Ghana's Diaspora Affairs Office or the Ministry of the Interior.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyMembership, listMyConsents, listGhanaRegions],
});

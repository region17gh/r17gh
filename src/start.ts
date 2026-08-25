import { createStart } from "@tanstack/react-start";

import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

/**
 * Start entry. Registering the auth attacher globally is what puts the member's
 * bearer token on every server function call; without it `requireSupabaseAuth`
 * sees no Authorization header and every reservation call is unauthenticated.
 */
export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
}));

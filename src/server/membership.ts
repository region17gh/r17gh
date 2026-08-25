import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Member numbers are issued here and nowhere else.
 *
 * `reserve_member_number()` is service_role only, and `number_reservations`
 * carries no policies at all, so neither the reservation nor the reason a
 * reservation died can be read from the browser. That is deliberate: it keeps
 * the founding-window sequence off the client, and it is why this route exists.
 */

const ensureInput = z.object({
  /** A number the caller believes it is holding, from the persisted draft. */
  heldNumber: z.number().int().positive().nullable().optional(),
});

/** Why a held reservation is no longer usable. Chooses the words the member sees. */
export type LapseReason = "expired" | "claimed" | "unknown";

export type ReservationResult =
  | { status: "already_member" }
  | {
      status: "held" | "issued" | "reissued";
      memberNumber: number;
      credentialId: string;
      expiresAt: string;
      /** Present only on "reissued": the number in hand had lapsed. */
      reason?: LapseReason;
    };

export const ensureReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => ensureInput.parse(input))
  .handler(async ({ data, context }): Promise<ReservationResult> => {
    // Imported inside the handler so the service-role client never reaches a
    // client bundle, per the note on client.server.ts.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // One auth account holds at most one member record. register_member()
    // enforces it too; catching it here routes the member instead of failing.
    const existing = await supabaseAdmin
      .from("members")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) return { status: "already_member" };

    if (data.heldNumber != null) {
      const held = await supabaseAdmin
        .from("number_reservations")
        .select("member_number, expires_at, claimed_by, claimed_at")
        .eq("member_number", data.heldNumber)
        .maybeSingle();
      if (held.error) throw new Error(held.error.message);

      const row = held.data;
      const live =
        row !== null &&
        row.claimed_by === null &&
        row.claimed_at === null &&
        Date.parse(row.expires_at) > Date.now();

      if (live && row) {
        return {
          status: "held",
          memberNumber: row.member_number,
          credentialId: await credentialFor(row.member_number),
          expiresAt: row.expires_at,
        };
      }

      const reason: LapseReason =
        row === null
          ? "unknown"
          : row.claimed_by !== null || row.claimed_at !== null
            ? "claimed"
            : "expired";

      const fresh = await issueReservation();
      return { status: "reissued", reason, ...fresh };
    }

    const fresh = await issueReservation();
    return { status: "issued", ...fresh };
  });

async function issueReservation() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("reserve_member_number");
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row) throw new Error("The register did not return a member number.");
  return {
    memberNumber: row.member_number,
    credentialId: row.credential_id,
    expiresAt: row.expires_at,
  };
}

/**
 * The credential ID for a reservation the member is already holding.
 *
 * Derived by the same database function that register_member() will use, so the
 * number shown on screen mid-flow is the one that ends up on the record.
 */
async function credentialFor(memberNumber: number): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("credential_id", {
    join_year: new Date().getUTCFullYear(),
    member_number: memberNumber,
  });
  if (error) throw new Error(error.message);
  return data;
}

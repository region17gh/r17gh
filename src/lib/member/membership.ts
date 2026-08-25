import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type MemberRow = Database["public"]["Tables"]["members"]["Row"];

/** The signed-in member's own record, or null if this account has not joined yet. */
export async function fetchCurrentMember(): Promise<MemberRow | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export type VerificationOutcome =
  | { status: "verified"; member: MemberRow }
  | { status: "handle_taken" }
  | { status: "handle_reserved" }
  | { status: "no_member" }
  | { status: "signed_out" }
  | { status: "email_unconfirmed" }
  | { status: "email_mismatch" }
  | { status: "not_pending" }
  | { status: "failed"; message: string };

/**
 * Commits verification: the record goes active and the chosen address goes live.
 *
 * Every check that matters happens inside `activate_membership()`, in the
 * database. It reads `auth.users.email_confirmed_at` there, which GoTrue sets
 * only when a code or link it emailed is actually used, and it refuses anything
 * that is not a `pending_verification` record whose address matches the
 * confirmed one. There is deliberately no check here to match: a rule this page
 * could evaluate is a rule anyone holding the anon key could skip, which is
 * what made `pending_verification` decorative before.
 *
 * The handle is passed and written only if the record holds none, so it does
 * not spend the member's one permitted change.
 */
export async function commitVerification(handle: string): Promise<VerificationOutcome> {
  const { data, error } = await supabase.rpc("activate_membership", {
    p_handle: handle.trim() || undefined,
  });

  if (error) return classifyActivationError(error.code, error.message);
  if (!data) return { status: "no_member" };
  return { status: "verified", member: data };
}

/** The database's refusals, in the words this screen answers them with. */
function classifyActivationError(code: string, message: string): VerificationOutcome {
  if (message.includes("Sign in required")) return { status: "signed_out" };
  if (message.includes("has not been confirmed")) return { status: "email_unconfirmed" };
  if (message.includes("has not joined yet")) return { status: "no_member" };
  if (message.includes("not the address on this record")) return { status: "email_mismatch" };
  if (message.includes("not awaiting verification")) return { status: "not_pending" };
  if (message.includes("reserved")) return { status: "handle_reserved" };
  if (code === "23505" || message.includes("duplicate key")) return { status: "handle_taken" };
  return { status: "failed", message };
}

export interface MemberIntent {
  ask: string | null;
  offer: string | null;
}

export async function fetchIntent(memberId: string): Promise<MemberIntent> {
  const { data, error } = await supabase
    .from("member_intent")
    .select("current_ask, current_offer")
    .eq("member_id", memberId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { ask: data?.current_ask ?? null, offer: data?.current_offer ?? null };
}

/** The founding-window cutoff, so the credential states a date it did not invent. */
export async function fetchFoundingCutoff(): Promise<Date | null> {
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "founding_member_cutoff")
    .maybeSingle();
  if (error || !data) return null;
  const raw = typeof data.value === "string" ? data.value : String(data.value);
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

/**
 * Whether an address is on the reserved list.
 *
 * Checked before registration so a member is not sent all the way to
 * verification only to be turned back. The list is readable to signed-in
 * members, and the trigger on `members` remains the authority.
 */
export async function isHandleReserved(handle: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("reserved_handles")
    .select("handle")
    .eq("handle", handle)
    .maybeSingle();
  if (error) return false; // Never block a join on this check; the trigger still holds.
  return data !== null;
}

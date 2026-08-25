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
  | { status: "email_unconfirmed" }
  | { status: "failed"; message: string };

/**
 * Commits verification: the record goes active and the chosen address goes live.
 *
 * Until this runs the member's status is `pending_verification`, which is what
 * keeps an unverified account from holding a public address. The handle is
 * written here for the first time, so it does not consume the member's one
 * permitted change: the trigger only stamps `handle_changed_at` when an
 * existing handle is replaced.
 */
export async function commitVerification(handle: string): Promise<VerificationOutcome> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "no_member" };

  // Supabase set this when the member entered the one-time code at step 1.
  // Without it there is nothing here that proves control of the address.
  if (!auth.user.email_confirmed_at) return { status: "email_unconfirmed" };

  const existing = await fetchCurrentMember();
  if (!existing) return { status: "no_member" };

  const patch: Database["public"]["Tables"]["members"]["Update"] = {
    email_verified_at: new Date().toISOString(),
    status: "active",
  };
  // A member who already holds an address keeps it: their one change is theirs
  // to spend in settings, not something verification spends for them.
  if (!existing.handle && handle) patch.handle = handle;

  const { data, error } = await supabase
    .from("members")
    .update(patch)
    .eq("user_id", auth.user.id)
    .select("*")
    .single();

  if (error) {
    if (error.message.includes("reserved")) return { status: "handle_reserved" };
    if (error.code === "23505" || error.message.includes("duplicate key")) {
      return { status: "handle_taken" };
    }
    return { status: "failed", message: error.message };
  }

  return { status: "verified", member: data };
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

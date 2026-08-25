import { supabase } from "@/integrations/supabase/client";

import type { JoinDraft } from "./draft";
import { CONSENTS, CONSENT_MECHANISM } from "./options";

/**
 * Everything written when a member joins, in the order it matters.
 *
 * `register_member()` is the only path to a `members` row and it writes nothing
 * else, so the records that make the registration lawful are written here
 * immediately afterwards: the affirmation first, then the consents, then the
 * defaulted visibility and settings rows, then the optional detail.
 *
 * The handle is deliberately not passed. An unverified account does not own a
 * public address; the chosen handle stays in the draft and is committed at
 * /verify.
 */

export interface PolicyVersions {
  compact: string;
  conduct: string;
  privacy: string;
}

export type RegistrationOutcome =
  | { status: "registered"; memberId: string; memberNumber: number; credentialId: string; incomplete: string[] }
  | { status: "already_member" }
  | { status: "reservation_lapsed" }
  | { status: "signed_out" }
  | { status: "underage" }
  | { status: "failed"; message: string };

/** Reads the live policy versions. Consent rows are meaningless without them. */
export async function loadPolicyVersions(): Promise<PolicyVersions> {
  const { data, error } = await supabase
    .from("app_config")
    .select("key, value")
    .in("key", ["compact_version", "conduct_version", "privacy_version"]);
  if (error) throw new Error(error.message);

  const read = (key: string): string => {
    const row = data?.find((r) => r.key === key);
    // Values are stored as JSON scalars, e.g. "1.0".
    return typeof row?.value === "string" ? row.value : String(row?.value ?? "");
  };

  const versions = {
    compact: read("compact_version"),
    conduct: read("conduct_version"),
    privacy: read("privacy_version"),
  };
  if (!versions.compact || !versions.conduct || !versions.privacy) {
    throw new Error("Policy versions are missing from app_config.");
  }
  return versions;
}

function classifyRegisterError(message: string): RegistrationOutcome {
  if (message.includes("already holds a member record")) return { status: "already_member" };
  if (message.includes("No live reservation")) return { status: "reservation_lapsed" };
  if (message.includes("Sign in required")) return { status: "signed_out" };
  if (message.includes("18 or older")) return { status: "underage" };
  return { status: "failed", message };
}

export async function registerMember(
  draft: JoinDraft,
  versions: PolicyVersions,
): Promise<RegistrationOutcome> {
  if (!draft.reservation) return { status: "reservation_lapsed" };

  const { data, error } = await supabase.rpc("register_member", {
    p_member_number: draft.reservation.memberNumber,
    p_first_name: draft.firstName.trim() || undefined,
    p_last_name: draft.lastName.trim() || undefined,
    p_email: draft.email.trim() || undefined,
    p_birth_month: draft.birthMonth ?? undefined,
    p_birth_year: draft.birthYear ?? undefined,
    p_country: draft.country || undefined,
    p_city: draft.city.trim() || undefined,
    p_timezone: resolveTimezone(),
    p_connection_types: draft.connections,
    p_region_interests: draft.regions,
    // p_handle and p_primary_connection are left unset on purpose. See above for
    // the handle; primary_connection would rank one of a member's own answers
    // above the others, and no connection outranks another.
  });

  if (error) return classifyRegisterError(error.message);

  const row = data?.[0];
  if (!row) return { status: "failed", message: "The register returned no credential." };

  const incomplete = await writeMembershipRecords(row.member_id, draft, versions);

  return {
    status: "registered",
    memberId: row.member_id,
    memberNumber: row.member_number,
    credentialId: row.credential_id,
    incomplete,
  };
}

/**
 * Writes the records that accompany a membership.
 *
 * Returns the names of anything that would not write. The member row already
 * exists at this point and cannot be rolled back, so a failure here is reported
 * and retried rather than hidden.
 */
export async function writeMembershipRecords(
  memberId: string,
  draft: JoinDraft,
  versions: PolicyVersions,
): Promise<string[]> {
  const incomplete: string[] = [];

  const step = async (name: string, run: () => Promise<{ error: { message: string } | null }>) => {
    const first = await run();
    if (!first.error) return;
    const retry = await run();
    if (retry.error) incomplete.push(name);
  };

  await step("affirmation", async () =>
    supabase.from("affirmations").insert({
      member_id: memberId,
      compact_version: versions.compact,
      conduct_version: versions.conduct,
    }),
  );

  const granted = CONSENTS.filter((c) => draft.consents.includes(c.value));
  if (granted.length > 0) {
    await step("consents", async () =>
      supabase.from("member_consents").insert(
        granted.map((consent) => ({
          member_id: memberId,
          consent_type: consent.value,
          policy_version: versions.privacy,
          mechanism: consent.defaultOn ? CONSENT_MECHANISM.leftDefaultOn : CONSENT_MECHANISM.ticked,
        })),
      ),
    );
  }

  // Created with their table defaults. Every visibility column stays 'hidden':
  // a directory consent is a consent, not a publication.
  await step("visibility", async () =>
    supabase.from("member_visibility").insert({ member_id: memberId }),
  );
  await step("settings", async () => supabase.from("member_settings").insert({ member_id: memberId }));

  // Gender is written for every member, including those who decline, so that a
  // declined answer is indistinguishable from one not yet given.
  await step("gender", async () =>
    supabase.from("member_gender").insert({ member_id: memberId, gender: draft.gender }),
  );

  const ask = draft.ask.trim();
  const offer = draft.offer.trim();
  if (ask || offer) {
    const now = new Date().toISOString();
    await step("intent", async () =>
      supabase.from("member_intent").insert({
        member_id: memberId,
        current_ask: ask || null,
        ask_updated_at: ask ? now : null,
        current_offer: offer || null,
        offer_updated_at: offer ? now : null,
      }),
    );
  }

  const role = draft.role.trim();
  const organization = draft.organization.trim();
  if (role || organization) {
    await step("profile", async () =>
      supabase.from("member_profiles").insert({
        member_id: memberId,
        role: role || null,
        organization: organization || null,
      }),
    );
  }

  return incomplete;
}

/** The member's own time zone, so town hall times can be shown in it later. */
export function resolveTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

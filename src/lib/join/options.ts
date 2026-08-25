import type { Database } from "@/integrations/supabase/types";

export type ConnectionType = Database["public"]["Enums"]["connection_type"];
export type ConsentType = Database["public"]["Enums"]["consent_type"];
export type GenderIdentity = Database["public"]["Enums"]["gender_identity"];

/**
 * The six ways of belonging, in the prototype's order.
 *
 * Flat by construction: no weight, no sort, no primary. `primary_connection` is
 * deliberately left null at registration, because choosing one would rank a
 * member's belonging against their own other answers.
 */
export interface ConnectionOption {
  value: ConnectionType;
  /** Dictionary key under join.connections.<key> */
  key: string;
}

export const CONNECTIONS: ConnectionOption[] = [
  { value: "ghanaian_abroad", key: "ghanaianAbroad" },
  { value: "ghanaian_heritage", key: "ghanaianHeritage" },
  { value: "african_diaspora", key: "africanDiaspora" },
  { value: "ghanaian_at_home", key: "ghanaianAtHome" },
  { value: "african_continental", key: "africanContinental" },
  { value: "ally", key: "ally" },
];

/**
 * Consents offered at the Compact.
 *
 * `defaultOn` is true for exactly one of them. Everything that shares, exposes
 * or exports a member's record is off until the member turns it on.
 *
 * These are recorded as rows in `member_consents`, never as booleans on the
 * member. Granting `directory_visibility` records a consent and nothing else:
 * it must not touch `member_visibility`, whose columns stay `hidden` until the
 * member changes them in settings.
 */
export interface ConsentOption {
  value: ConsentType;
  key: string;
  group: "record" | "contact";
  defaultOn: boolean;
}

export const CONSENTS: ConsentOption[] = [
  { value: "directory_visibility", key: "directory", group: "record", defaultOn: false },
  { value: "institutional_discoverability", key: "institutions", group: "record", defaultOn: false },
  { value: "daoop_sharing", key: "daoop", group: "record", defaultOn: false },
  { value: "aggregate_research", key: "research", group: "record", defaultOn: false },
  { value: "townhall_invites", key: "townhall", group: "contact", defaultOn: true },
  { value: "programme_updates", key: "programmes", group: "contact", defaultOn: false },
];

/**
 * How a consent was given, stored on the row.
 *
 * The two values are kept distinct on purpose: a regulator asking how consent
 * was obtained is entitled to know which boxes the member ticked and which
 * were presented already ticked.
 */
export const CONSENT_MECHANISM = {
  ticked: "join_v1:checkbox",
  leftDefaultOn: "join_v1:checkbox_default_on",
} as const;

export interface GenderOption {
  value: GenderIdentity;
  key: string;
}

/**
 * Gender is optional and `prefer_not_to_say` is the stored default, so a member
 * who declines is indistinguishable from one who has not answered yet.
 *
 * `self_described` has no free-text partner here. `member_gender` stores the
 * enum only, and adding a text column would put an unstructured account of a
 * member's identity in the register. See the PR for the open question.
 */
export const GENDERS: GenderOption[] = [
  { value: "prefer_not_to_say", key: "preferNotToSay" },
  { value: "woman", key: "woman" },
  { value: "man", key: "man" },
  { value: "non_binary", key: "nonBinary" },
  { value: "self_described", key: "selfDescribed" },
];

/** Free-text limit on Ask and Offer, matching the prototype. */
export const INTENT_MAX_LENGTH = 160;

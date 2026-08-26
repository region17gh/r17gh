import type { ConnectionType, ConsentType, GenderIdentity } from "./options";
import { CONSENTS } from "./options";

/**
 * The in-progress join, held in local storage.
 *
 * Members are frequently mobile-first on metered or unreliable connections. A
 * dropped connection or an accidental refresh part-way through must not cost
 * someone the four screens they have already filled in.
 *
 * What is deliberately never written here: the one-time code, any access token,
 * and any answer given before the age gate has passed. `clearDraft()` is called
 * when an under-18 date of birth is entered, so a minor's details never persist.
 */

const STORAGE_KEY = "r17.join.draft.v1";

export interface HeldReservation {
  memberNumber: number;
  credentialId: string;
  expiresAt: string;
}

export interface JoinDraft {
  step: number;
  birthMonth: number | null;
  birthYear: number | null;
  firstName: string;
  lastName: string;
  email: string;
  city: string;
  country: string;
  subdivision: string;
  gender: GenderIdentity;
  connections: ConnectionType[];
  regions: string[];
  ask: string;
  offer: string;
  role: string;
  organization: string;
  consents: ConsentType[];
  handle: string;
  reservation: HeldReservation | null;
}

export function emptyDraft(): JoinDraft {
  return {
    step: 1,
    birthMonth: null,
    birthYear: null,
    firstName: "",
    lastName: "",
    email: "",
    city: "",
    country: "",
    subdivision: "",
    gender: "prefer_not_to_say",
    connections: [],
    regions: [],
    ask: "",
    offer: "",
    role: "",
    organization: "",
    consents: CONSENTS.filter((c) => c.defaultOn).map((c) => c.value),
    handle: "",
    reservation: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Rebuilds a draft from whatever is in storage, field by field.
 *
 * Anything unrecognised is dropped rather than trusted: the stored blob is
 * attacker-writable in the member's own browser, and it is handed straight to
 * form state and then to the register call.
 */
function reviveDraft(raw: unknown): JoinDraft {
  if (!isRecord(raw)) return emptyDraft();
  const base = emptyDraft();
  const reservation = isRecord(raw["reservation"]) ? raw["reservation"] : null;
  const memberNumber = reservation ? num(reservation["memberNumber"]) : null;

  return {
    ...base,
    step: num(raw["step"]) ?? base.step,
    birthMonth: num(raw["birthMonth"]),
    birthYear: num(raw["birthYear"]),
    firstName: str(raw["firstName"]),
    lastName: str(raw["lastName"]),
    email: str(raw["email"]),
    city: str(raw["city"]),
    country: str(raw["country"]),
    subdivision: str(raw["subdivision"]),
    gender: (str(raw["gender"], base.gender) as GenderIdentity) || base.gender,
    connections: strList(raw["connections"]) as ConnectionType[],
    regions: strList(raw["regions"]),
    ask: str(raw["ask"]),
    offer: str(raw["offer"]),
    role: str(raw["role"]),
    organization: str(raw["organization"]),
    consents: strList(raw["consents"]) as ConsentType[],
    handle: str(raw["handle"]),
    reservation:
      reservation && memberNumber !== null
        ? {
            memberNumber,
            credentialId: str(reservation["credentialId"]),
            expiresAt: str(reservation["expiresAt"]),
          }
        : null,
  };
}

export function loadDraft(): JoinDraft {
  if (typeof window === "undefined") return emptyDraft();
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return emptyDraft();
    return reviveDraft(JSON.parse(stored) as unknown);
  } catch {
    // Private browsing, a full quota or a corrupt blob: start clean rather than
    // block the member out of joining.
    return emptyDraft();
  }
}

export function saveDraft(draft: JoinDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Storage being unavailable costs resilience, never the registration.
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do: the member is leaving this flow either way.
  }
}

/** A reservation is worth presenting only while it is still live. */
export function reservationIsLive(
  reservation: HeldReservation | null,
  now: Date = new Date(),
): boolean {
  if (!reservation) return false;
  const expires = Date.parse(reservation.expiresAt);
  return Number.isFinite(expires) && expires > now.getTime();
}

/**
 * The address chosen at the Compact, held until verification commits it.
 *
 * Kept apart from the draft because the draft is cleared the moment the member
 * is entered into the register, while this has to survive that moment: the
 * handle is written at /verify, not at registration.
 */
const PENDING_HANDLE_KEY = "r17.join.handle.v1";

export function savePendingHandle(handle: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PENDING_HANDLE_KEY, handle);
  } catch {
    // The member can retype it at /verify.
  }
}

export function loadPendingHandle(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(PENDING_HANDLE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearPendingHandle(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_HANDLE_KEY);
  } catch {
    // Nothing further to do.
  }
}

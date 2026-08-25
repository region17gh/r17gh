import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";

/**
 * The welcome email, sent once, on activation.
 *
 * ON ACTIVATION, NOT ON REGISTRATION. A record is `pending_verification` from
 * the moment it is created until the member confirms their address, and an
 * account that never confirms must never be written to. So the gate here is the
 * record's own `status`, read server-side with the service-role client, not
 * anything the caller says about itself.
 *
 * SENT ONCE. `activate_membership()` is a no-op that succeeds when run against
 * an already-active record, which is correct for activation and useless as a
 * send trigger: the caller cannot tell a transition from a repeat. The claim
 * below settles it. One statement stamps `welcome_email_sent_at` where it is
 * still null, so two concurrent calls race for the row and exactly one comes
 * back holding a row.
 *
 * The claim is taken BEFORE the send. If the send then fails, the claim is
 * released and the member gets another attempt on their next visit. Claiming
 * after a successful send would look tidier and would send twice whenever the
 * process died between the two.
 */

const welcomeInput = z.object({
  /** The locale the member is reading the site in. Used for the copy only. */
  locale: z.string().max(16).optional(),
});

export type WelcomeOutcome =
  /** Sent now, or queued at Resend for the member's local morning. */
  | { status: "sent"; scheduledAt: string | null }
  /** Already sent. The ordinary answer on every visit after the first. */
  | { status: "already_sent" }
  /** Not active yet, so nothing is sent. */
  | { status: "not_active" }
  | { status: "no_member" }
  | { status: "no_address" }
  /**
   * The transport refused, or a database read/write failed. Logged
   * server-side either way. The claim was released or never taken, so the
   * next visit tries again -- which recovers a transient failure and, for a
   * persistent one (a schema mismatch, a revoked grant), repeats the same
   * logged failure on every visit rather than going quiet after the first.
   */
  | { status: "failed" };

export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => welcomeInput.parse(input))
  .handler(async ({ data, context }): Promise<WelcomeOutcome> => {
    // Imported inside the handler so neither the service-role client nor the
    // Resend key reaches a client bundle, per the note on client.server.ts.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildWelcomeEmail } = await import("@/lib/email/welcome");
    const { nextLocalMorning } = await import("@/lib/email/schedule");
    const { sendEmail } = await import("./resend.server");

    const locale = isLocale(data.locale) ? data.locale : DEFAULT_LOCALE;

    const found = await supabaseAdmin
      .from("members")
      .select(
        "id, email, first_name, member_number, credential_id, founding_member, class_year, timezone, status, welcome_email_sent_at",
      )
      .eq("user_id", context.userId)
      .maybeSingle();
    if (found.error) {
      console.error(
        `[welcome] Could not read member for user ${context.userId}: ${found.error.message}`,
      );
      return { status: "failed" };
    }

    const member = found.data;
    if (!member) return { status: "no_member" };
    if (member.welcome_email_sent_at) return { status: "already_sent" };
    // The record's own standing, not the caller's claim about it. This is what
    // keeps an unverified account from ever receiving this message.
    if (member.status !== "active") return { status: "not_active" };
    // Erasure nulls the address. A record with none is not written to.
    if (!member.email) return { status: "no_address" };

    // The claim. One statement, so it is atomic: a concurrent call matches zero
    // rows and returns already_sent rather than sending a second copy.
    const claim = await supabaseAdmin
      .from("members")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", member.id)
      .is("welcome_email_sent_at", null)
      .eq("status", "active")
      .select("id");
    if (claim.error) {
      console.error(`[welcome] Could not claim send for member ${member.id}: ${claim.error.message}`);
      return { status: "failed" };
    }
    if (!claim.data || claim.data.length === 0) return { status: "already_sent" };

    const built = buildWelcomeEmail(
      {
        firstName: member.first_name,
        memberNumber: member.member_number,
        credentialId: member.credential_id,
        foundingMember: member.founding_member,
        classYear: member.class_year,
        foundingCutoff: await foundingCutoff(),
      },
      { locale, siteUrl: siteUrl() },
    );

    // Their local morning, where the record knows what local is. Resend holds
    // the message; nothing here waits for it.
    const scheduledAt = nextLocalMorning(new Date(), member.timezone);

    const result = await sendEmail({
      to: member.email,
      subject: built.subject,
      html: built.html,
      text: built.text,
      scheduledAt,
      idempotencyKey: `welcome:${member.id}`,
    });

    if (!result.sent) {
      // Release the claim so the next visit tries again. Failing to release it
      // would cost this member their welcome email permanently.
      await supabaseAdmin
        .from("members")
        .update({ welcome_email_sent_at: null })
        .eq("id", member.id);
      console.error(`[welcome] Send refused: ${result.reason}`);
      return { status: "failed" };
    }

    return { status: "sent", scheduledAt };
  });

/**
 * The founding-window cutoff, read from app_config.
 *
 * The email states the date the register holds, never one computed here, for
 * the same reason the credential does: a member is told what their record says.
 */
async function foundingCutoff(): Promise<Date | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_config")
    .select("value")
    .eq("key", "founding_member_cutoff")
    .maybeSingle();
  if (!data) return null;
  const raw = typeof data.value === "string" ? data.value : String(data.value);
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

/**
 * The origin the email's one link points at.
 *
 * Read from the environment and never from the caller. A link in an email that
 * a browser got to choose is a phishing vector: the recipient sees a Region 17
 * message carrying somebody else's address.
 */
function siteUrl(): string {
  return process.env["SITE_URL"]?.trim() || "https://r17gh.com";
}

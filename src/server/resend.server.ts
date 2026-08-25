/**
 * The Resend transport.
 *
 * `.server.ts`, imported only from inside a server handler, so the API key
 * never reaches a client bundle. The key is read from the environment, is never
 * returned or logged, and leaves this module only as an Authorization header.
 *
 * Supabase custom SMTP already routes auth mail through Resend. That is GoTrue's
 * own path and has nothing to do with this one: this is the API, for mail the
 * application sends itself.
 */

const RESEND_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 15_000;

export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * ISO 8601 instant to hold the message until, or null to send now. Resend
   * queues it; nothing here has to stay awake for it.
   */
  scheduledAt?: string | null;
  /**
   * Deduplicates a retried send at Resend for 24 hours. A second belt only: the
   * first is the claim on the member record, which is durable and this is not.
   */
  idempotencyKey?: string;
}

export type SendResult =
  | { sent: true; id: string | null }
  | { sent: false; reason: string };

/** The address mail is sent from. Configured, never guessed. */
export function senderAddress(): string | null {
  return process.env["RESEND_FROM"]?.trim() || null;
}

/**
 * Sends one message.
 *
 * Never throws: a welcome email that will not send must not take down the
 * activation that triggered it. The caller decides what a failure means, and
 * for the welcome email it means releasing the claim so the next attempt can
 * take it.
 */
export async function sendEmail(message: OutboundEmail): Promise<SendResult> {
  const apiKey = process.env["RESEND_API_KEY"]?.trim();
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY is not set" };

  const from = senderAddress();
  if (!from) return { sent: false, reason: "RESEND_FROM is not set" };

  const headers: Record<string, string> = {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
  };
  if (message.idempotencyKey) headers["Idempotency-Key"] = message.idempotencyKey;

  const body: Record<string, unknown> = {
    from,
    to: [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text,
  };
  if (message.scheduledAt) body["scheduled_at"] = message.scheduledAt;

  const replyTo = process.env["RESEND_REPLY_TO"]?.trim();
  if (replyTo) body["reply_to"] = replyTo;

  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Resend's error text names the fault, not the recipient. The address is
      // deliberately not logged: it is personal data and this is a log.
      const detail = await response.text().catch(() => "");
      return { sent: false, reason: `Resend returned HTTP ${response.status}. ${detail}`.trim() };
    }

    const payload = (await response.json().catch(() => null)) as { id?: string } | null;
    return { sent: true, id: payload?.id ?? null };
  } catch {
    return { sent: false, reason: "Resend could not be reached" };
  }
}

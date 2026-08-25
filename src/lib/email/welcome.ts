import { translator, type Locale } from "@/i18n";

/**
 * The first email of the sequence, and the only one that exists.
 *
 * Text-forward and imageless. Not "one image and we chose not to use it": a
 * large share of members are on metered or unreliable connections, an image
 * costs them data to render a thing the text already says, and every image is a
 * surface that fails when a client blocks it. The credential is text for the
 * same reason and one more: a member must be able to select it, copy it, and
 * read it with images off. It is the thing the email exists to deliver.
 *
 * ON HARDCODED COLOUR. The house rule is that nothing carries a literal hex and
 * everything references a token. Email is the documented exception, and it has
 * to be: no email client resolves CSS custom properties, several strip <style>
 * blocks outright, and Outlook honours almost nothing that is not an inline
 * attribute. So the palette below is a copy of the token values, named after
 * the tokens it copies, kept in one block at the top rather than scattered
 * through the markup. When a token file is replaced, this block is the one
 * place to reconcile. It is a copy, not a redefinition: nothing here may
 * invent a colour the design system does not have.
 *
 * ON DARK MODE. The common failure is not "it looks wrong in dark mode", it is
 * partial inversion: a client flips some declarations and leaves others, and
 * the result is dark text on a dark ground. The defences here, in order of how
 * much they matter:
 *
 *   1. Every element that holds text declares its own colour inline and carries
 *      a class the dark block restates, and every container that paints a
 *      ground declares that ground inline. So a client that inverts one and not
 *      the other still has an explicit value for both, rather than a computed
 *      colour sitting on a ground it never saw.
 *   2. `color-scheme` is declared, which is what tells a supporting client not
 *      to invent its own inversion.
 *   3. A `prefers-color-scheme: dark` block restates the whole palette with
 *      `!important`, so a client that does honour <style> gets a designed dark
 *      rendering rather than a computed one.
 *   4. `[data-ogsc]` and `[data-ogsb]` selectors repeat it for Outlook.com,
 *      which rewrites the document and drops the media query.
 *   5. No pure #FFFFFF ground and no pure #000000 text. Those are the two
 *      values inverting clients treat most aggressively.
 */

/** The design system's values, copied because email cannot read the tokens. */
const PALETTE = {
  /** --paper-050, the page ground. */
  paper: "#FBFAF7",
  /** --paper-000 on --surface-card. */
  card: "#FFFDF9",
  /** --navy-700, Sovereign Navy. */
  navy: "#10233F",
  /** --navy-900. */
  navyDeep: "#08152B",
  /** --navy-300, readable on the deep ground. */
  navyMuted: "#8598B2",
  /** --gold-500, Seal Gold. */
  gold: "#D4AF37",
  /** --gold-700, which passes on paper where gold-500 does not. */
  goldInk: "#8A6D1C",
  /** --ink-700, body text. Not pure black: inverting clients over-correct it. */
  ink: "#33383F",
  /** --ink-500. */
  inkMuted: "#5C636D",
  /** --border-default. */
  border: "#D6D0C4",
  /** --text-on-inverse. */
  onInverse: "#F2F5F9",
} as const;

const FONT_SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const FONT_MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";

export interface WelcomeEmailMember {
  firstName: string | null;
  memberNumber: number;
  credentialId: string;
  foundingMember: boolean;
  classYear: number;
  /** The founding-window cutoff from app_config. Never a date invented here. */
  foundingCutoff: Date | null;
}

export interface WelcomeEmail {
  subject: string;
  html: string;
  text: string;
}

/** Builds the welcome email. Pure: the sender does the sending. */
export function buildWelcomeEmail(
  member: WelcomeEmailMember,
  options: { locale: Locale; siteUrl: string },
): WelcomeEmail {
  const t = translator(options.locale);
  const name = member.firstName?.trim() || t("email.welcome.fallbackName");
  const number = String(Math.max(0, Math.trunc(member.memberNumber))).padStart(6, "0");
  const actionUrl = `${options.siteUrl.replace(/\/+$/, "")}/${options.locale}/home`;

  // The founding note names the cutoff the database holds, formatted, and says
  // nothing when there is no cutoff to name. It never computes the standing:
  // that is the record's own frozen flag, arriving in `member`.
  const foundingNote =
    member.foundingMember && member.foundingCutoff
      ? t("email.welcome.foundingNote", {
          date: formatCutoff(member.foundingCutoff, options.locale),
        })
      : "";

  const rows: { label: string; value: string; mono?: boolean }[] = [
    { label: t("email.welcome.memberNumberLabel"), value: number, mono: true },
    { label: t("email.welcome.credentialIdLabel"), value: member.credentialId, mono: true },
  ];
  if (member.foundingMember) {
    rows.push({ label: t("email.welcome.standingLabel"), value: t("email.welcome.founding") });
  }
  rows.push({ label: t("email.welcome.classLabel"), value: String(member.classYear) });

  return {
    subject: t("email.welcome.subject", { number }),
    html: renderHtml({ t, name, number, rows, foundingNote, actionUrl, locale: options.locale }),
    text: renderText({ t, name, number, rows, foundingNote, actionUrl }),
  };
}

interface RenderInput {
  t: ReturnType<typeof translator>;
  name: string;
  number: string;
  rows: { label: string; value: string; mono?: boolean }[];
  foundingNote: string;
  actionUrl: string;
}

function renderText({ t, name, rows, foundingNote, actionUrl }: RenderInput): string {
  // The plain-text part is not a courtesy. It is what a screen reader on a
  // text-only client reads, and what survives when a client refuses HTML.
  const lines = [
    t("email.welcome.greeting", { name }),
    "",
    t("email.welcome.opening"),
    "",
    t("email.welcome.credentialHeading").toUpperCase(),
    ...rows.map((row) => `${row.label}: ${row.value}`),
    "",
    t("email.welcome.permanent"),
  ];
  if (foundingNote) lines.push("", foundingNote);
  lines.push(
    "",
    t("email.welcome.actionHeading").toUpperCase(),
    t("email.welcome.actionBody"),
    "",
    `${t("email.welcome.actionButton")}: ${actionUrl}`,
    "",
    // Safety control, not copy. Reproduced verbatim from the dictionary.
    t("legal.notAGovernmentDocument"),
    "",
    t("email.welcome.footerWhy"),
    t("email.welcome.footerOrg"),
  );
  return lines.join("\n");
}

function renderHtml({
  t,
  name,
  number,
  rows,
  foundingNote,
  actionUrl,
  locale,
}: RenderInput & { locale: Locale }): string {
  const credentialRows = rows
    .map(
      (row) => `
              <tr>
                <td style="padding:0 0 4px 0;font:400 12px/1.4 ${FONT_SANS};letter-spacing:0.08em;text-transform:uppercase;color:${PALETTE.inkMuted};background-color:${PALETTE.card};" class="r17-muted r17-card">${escape(row.label)}</td>
              </tr>
              <tr>
                <td style="padding:0 0 16px 0;font:600 18px/1.4 ${row.mono ? FONT_MONO : FONT_SANS};color:${PALETTE.navy};background-color:${PALETTE.card};" class="r17-strong r17-card">${escape(row.value)}</td>
              </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="${escape(locale)}" style="color-scheme:light dark;supported-color-schemes:light dark;">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escape(t("email.welcome.subject", { number }))}</title>
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin:0; padding:0; width:100% !important; }
  a { color:${PALETTE.goldInk}; }
  @media (prefers-color-scheme: dark) {
    .r17-page  { background-color:${PALETTE.navyDeep} !important; }
    .r17-card  { background-color:${PALETTE.navy} !important; }
    .r17-body  { color:${PALETTE.onInverse} !important; }
    .r17-strong{ color:${PALETTE.onInverse} !important; }
    .r17-muted { color:${PALETTE.navyMuted} !important; }
    .r17-rule  { border-color:${PALETTE.gold} !important; }
    .r17-btn   { background-color:${PALETTE.gold} !important; color:${PALETTE.navyDeep} !important; }
    a          { color:${PALETTE.gold} !important; }
  }
  /* Outlook.com rewrites the document and drops the media query above. */
  [data-ogsc] .r17-page  { background-color:${PALETTE.navyDeep} !important; }
  [data-ogsc] .r17-card  { background-color:${PALETTE.navy} !important; }
  [data-ogsc] .r17-body  { color:${PALETTE.onInverse} !important; }
  [data-ogsc] .r17-strong{ color:${PALETTE.onInverse} !important; }
  [data-ogsc] .r17-muted { color:${PALETTE.navyMuted} !important; }
  [data-ogsc] .r17-btn   { background-color:${PALETTE.gold} !important; color:${PALETTE.navyDeep} !important; }
  [data-ogsb] .r17-page  { background-color:${PALETTE.navyDeep} !important; }
  [data-ogsb] .r17-card  { background-color:${PALETTE.navy} !important; }
</style>
</head>
<body class="r17-page" style="margin:0;padding:0;background-color:${PALETTE.paper};">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escape(t("email.welcome.preheader"))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="r17-page" style="background-color:${PALETTE.paper};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

        <tr>
          <td class="r17-card" style="background-color:${PALETTE.card};padding:32px 28px 8px 28px;border-top:3px solid ${PALETTE.gold};">
            <p class="r17-muted" style="margin:0 0 8px 0;font:400 12px/1.4 ${FONT_SANS};letter-spacing:0.1em;text-transform:uppercase;color:${PALETTE.goldInk};">Region 17 &middot; Ghana</p>
            <h1 class="r17-strong" style="margin:0;font:600 26px/1.25 ${FONT_SANS};color:${PALETTE.navy};">${escape(t("email.welcome.greeting", { name }))}</h1>
            <p class="r17-body" style="margin:16px 0 0 0;font:400 16px/1.6 ${FONT_SANS};color:${PALETTE.ink};">${escape(t("email.welcome.opening"))}</p>
          </td>
        </tr>

        <tr>
          <td class="r17-card" style="background-color:${PALETTE.card};padding:24px 28px 8px 28px;">
            <p class="r17-muted" style="margin:0 0 16px 0;font:400 12px/1.4 ${FONT_SANS};letter-spacing:0.08em;text-transform:uppercase;color:${PALETTE.goldInk};">${escape(t("email.welcome.credentialHeading"))}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PALETTE.card};" class="r17-card">${credentialRows}
            </table>
            <p class="r17-muted" style="margin:0;font:400 14px/1.6 ${FONT_SANS};color:${PALETTE.inkMuted};">${escape(t("email.welcome.permanent"))}</p>
            ${
              foundingNote
                ? `<p class="r17-body r17-rule" style="margin:16px 0 0 0;padding:14px 16px;font:400 14px/1.6 ${FONT_SANS};color:${PALETTE.ink};border-left:3px solid ${PALETTE.gold};background-color:${PALETTE.card};">${escape(foundingNote)}</p>`
                : ""
            }
          </td>
        </tr>

        <tr>
          <td class="r17-card" style="background-color:${PALETTE.card};padding:24px 28px 32px 28px;">
            <p class="r17-muted" style="margin:0 0 8px 0;font:400 12px/1.4 ${FONT_SANS};letter-spacing:0.08em;text-transform:uppercase;color:${PALETTE.goldInk};">${escape(t("email.welcome.actionHeading"))}</p>
            <p class="r17-body" style="margin:0 0 20px 0;font:400 16px/1.6 ${FONT_SANS};color:${PALETTE.ink};">${escape(t("email.welcome.actionBody"))}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="r17-btn" style="background-color:${PALETTE.navy};border-radius:4px;">
                  <a href="${escape(actionUrl)}" class="r17-btn" style="display:inline-block;padding:14px 24px;font:600 16px/1.2 ${FONT_SANS};color:${PALETTE.onInverse};text-decoration:none;background-color:${PALETTE.navy};border-radius:4px;">${escape(t("email.welcome.actionButton"))}</a>
                </td>
              </tr>
            </table>
            <p class="r17-muted" style="margin:16px 0 0 0;font:400 13px/1.6 ${FONT_SANS};color:${PALETTE.inkMuted};">${escape(t("email.welcome.actionFallback"))}<br><span class="r17-muted" style="font-family:${FONT_MONO};color:${PALETTE.inkMuted};word-break:break-all;">${escape(actionUrl)}</span></p>
          </td>
        </tr>

        <tr>
          <td class="r17-page" style="background-color:${PALETTE.paper};padding:24px 28px;border-top:1px solid ${PALETTE.border};">
            <p class="r17-muted" style="margin:0 0 12px 0;font:400 13px/1.6 ${FONT_SANS};color:${PALETTE.inkMuted};">${escape(t("legal.notAGovernmentDocument"))}</p>
            <p class="r17-muted" style="margin:0 0 6px 0;font:400 12px/1.6 ${FONT_SANS};color:${PALETTE.inkMuted};">${escape(t("email.welcome.footerWhy"))}</p>
            <p class="r17-muted" style="margin:0;font:400 12px/1.6 ${FONT_SANS};color:${PALETTE.inkMuted};">${escape(t("email.welcome.footerOrg"))}</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/**
 * The date locale each content locale is written in.
 *
 * The house copy is British English, and the founding cutoff is written as
 * "31 December 2026" wherever it appears. Intl's bare "en" renders the American
 * order, "December 31, 2026", so the region is named rather than left to the
 * runtime's default.
 */
const DATE_LOCALE: Record<Locale, string> = { en: "en-GB" };

/** The cutoff, in words. Never a date invented here: it comes from app_config. */
function formatCutoff(cutoff: Date, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(DATE_LOCALE[locale] ?? locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(cutoff);
  } catch {
    return cutoff.toISOString().slice(0, 10);
  }
}

/** Every interpolated value is escaped. A member's own name reaches this. */
function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

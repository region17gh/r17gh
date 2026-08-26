import { translator, type Locale } from "@/i18n";
import { formatMemberNumber } from "@/components/join/memberNumber";
import sealSrc from "@/design-system/region-17-ghana-design-system-e3e62f/design-system/region17/assets/region17-seal.png";

/**
 * pdf-lib draws in raw RGB and cannot read a CSS custom property. This is the
 * same documented exception as src/lib/email/welcome.ts: a copy of the token
 * value, named after the token it copies, never a colour invented here.
 */
const NAVY_700 = { r: 0x10 / 255, g: 0x23 / 255, b: 0x3f / 255 }; // --navy-700, Sovereign Navy
const INK_700 = { r: 0x33 / 255, g: 0x38 / 255, b: 0x3f / 255 }; // --ink-700
const INK_MUTED = { r: 0x5c / 255, g: 0x63 / 255, b: 0x6d / 255 }; // --ink-500
const GOLD_INK = { r: 0x8a / 255, g: 0x6d / 255, b: 0x1c / 255 }; // --gold-700

export interface CredentialPdfMember {
  memberNumber: number;
  credentialId: string;
  firstName: string | null;
  lastName: string | null;
  foundingMember: boolean;
  classYear: number;
  /** Null when the address is not yet live. The row is left off, not blanked. */
  handle: string | null;
}

/** Centres a line of text set in `font` at `size`, returning its left edge. */
function centeredX(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, pageWidth: number): number {
  return (pageWidth - font.widthOfTextAtSize(text, size)) / 2;
}

/**
 * Builds and downloads the membership credential as a PDF.
 *
 * Contains only the credential itself: member number, credential ID, name,
 * standing, class year, and the member's public address. This is a document a
 * member may show someone, so it carries the same non-status disclaimer as the
 * credential on screen, verbatim.
 *
 * The seal is ceremonial and belongs here for exactly that reason: a
 * downloadable credential is the kind of formal, one-off document the seal
 * exists for. It never appears in product chrome.
 *
 * pdf-lib is the library here, not the more common jsPDF, because jsPDF's
 * browser bundle drags in html2canvas and DOMPurify regardless of which of its
 * features are used, adding well over a hundred kilobytes gzipped to what a
 * member downloads for one button press. pdf-lib draws text, images, and
 * shapes directly with no such passenger, which matters on the metered
 * connections this whole app is built around.
 */
export async function downloadCredentialPdf(member: CredentialPdfMember, locale: Locale): Promise<void> {
  const t = translator(locale);
  const [{ PDFDocument, StandardFonts, rgb }, sealBytes] = await Promise.all([
    import("pdf-lib"),
    fetch(sealSrc).then((response) => response.arrayBuffer()),
  ]);

  const name = [member.firstName?.trim(), member.lastName?.trim()].filter(Boolean).join(" ");
  const number = formatMemberNumber(member.memberNumber);
  const standing = member.foundingMember ? t("join.issued.founding") : t("home.standingMember");
  const address = member.handle ? `${t("join.step4.handlePrefix")}${member.handle}` : "";

  const rows: { label: string; value: string }[] = [];
  if (name) rows.push({ label: t("card.rowName"), value: name });
  rows.push(
    { label: t("home.memberNumber"), value: `${number.prefix}${number.tail}` },
    { label: t("home.credentialId"), value: member.credentialId },
    { label: t("home.status"), value: standing },
    { label: t("home.classLabel"), value: String(member.classYear) },
  );
  if (address) rows.push({ label: t("home.addressLabel"), value: address });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4, in points
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const centerX = pageWidth / 2;

  const seal = await pdf.embedPng(sealBytes);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const navy = rgb(NAVY_700.r, NAVY_700.g, NAVY_700.b);
  const ink = rgb(INK_700.r, INK_700.g, INK_700.b);
  const inkMuted = rgb(INK_MUTED.r, INK_MUTED.g, INK_MUTED.b);
  const goldInk = rgb(GOLD_INK.r, GOLD_INK.g, GOLD_INK.b);

  // 3px border in the design system's navy, framing the credential the way a
  // certificate is framed. The width is a literal from the brief, not a
  // token: the design system's own border-width tokens top out at 2px.
  const borderInset = 48;
  page.drawRectangle({
    x: borderInset,
    y: borderInset,
    width: pageWidth - borderInset * 2,
    height: pageHeight - borderInset * 2,
    borderColor: navy,
    borderWidth: 3,
  });

  // pdf-lib places the origin at the bottom left; y counts up the page, so
  // this walks downward from the top by decrementing rather than adding.
  let y = pageHeight - 120;
  const sealSize = 96;
  page.drawImage(seal, { x: centerX - sealSize / 2, y: y - sealSize, width: sealSize, height: sealSize });
  y -= sealSize + 32;

  const org = t("card.org").toUpperCase();
  page.drawText(org, { x: centeredX(org, regular, 11, pageWidth), y, size: 11, font: regular, color: goldInk });
  y -= 28;

  const heading = t("home.credentialHeading");
  page.drawText(heading, { x: centeredX(heading, bold, 20, pageWidth), y, size: 20, font: bold, color: navy });
  y -= 50;

  for (const row of rows) {
    const label = row.label.toUpperCase();
    page.drawText(label, { x: centeredX(label, regular, 10, pageWidth), y, size: 10, font: regular, color: inkMuted });
    y -= 18;

    page.drawText(row.value, { x: centeredX(row.value, bold, 15, pageWidth), y, size: 15, font: bold, color: ink });
    y -= 34;
  }

  y -= 14;
  // Safety control, not decoration. Its wording is fixed.
  for (const line of wrapText(t("legal.notAGovernmentDocument"), regular, 9, pageWidth - borderInset * 2 - 80)) {
    page.drawText(line, { x: centeredX(line, regular, 9, pageWidth), y, size: 9, font: regular, color: inkMuted });
    y -= 13;
  }

  const bytes = await pdf.save();
  // Copied into a freshly allocated buffer: pdf-lib's Uint8Array is typed
  // over ArrayBufferLike, which TypeScript's DOM lib does not accept as
  // BlobPart, and `new Uint8Array(length)` is the one construction that is
  // always backed by a plain ArrayBuffer rather than that wider type.
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `region17-credential-${member.credentialId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Deferred: revoking immediately can race the browser's own read of the
  // blob for the download it was just asked to start.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Greedy word wrap to a max width, since pdf-lib has no built-in wrapping. */
function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

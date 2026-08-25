/**
 * Member numbers are shown at a fixed six-digit width, with the leading zeros
 * dimmed. The width is what makes the register look like a register, and the
 * dimming keeps the eye on the number that is actually the member's.
 */
export function formatMemberNumber(value: number): { prefix: string; tail: string } {
  const padded = String(Math.max(0, Math.trunc(value))).padStart(6, "0");
  const grouped = `${padded.slice(0, 3)},${padded.slice(3)}`;
  const firstSignificant = grouped.search(/[1-9]/);
  if (firstSignificant <= 0) return { prefix: "", tail: grouped };
  return { prefix: grouped.slice(0, firstSignificant), tail: grouped.slice(firstSignificant) };
}

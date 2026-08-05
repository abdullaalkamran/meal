/** The sign-in identity rule: two phone numbers are the same account when
 * their digits match. Every phone comparison (login, signup uniqueness,
 * profile edit, walk-in matching) MUST use this one helper so the rules can
 * never drift apart. */
export const normalizePhone = (p: string) => p.replace(/[^0-9]/g, "");

/** Converts a locally-formatted Bangladeshi number (e.g. "01711-123456",
 * stored verbatim as typed at signup) into the full international digits a
 * `wa.me/<number>` link needs — no `+`, no separators, country code included. */
export function toWhatsAppNumber(p: string): string {
  const digits = normalizePhone(p);
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return `880${digits.slice(1)}`;
  return `880${digits}`;
}

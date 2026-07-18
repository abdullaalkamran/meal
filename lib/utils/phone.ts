/** The sign-in identity rule: two phone numbers are the same account when
 * their digits match. Every phone comparison (login, signup uniqueness,
 * profile edit, walk-in matching) MUST use this one helper so the rules can
 * never drift apart. */
export const normalizePhone = (p: string) => p.replace(/[^0-9]/g, "");

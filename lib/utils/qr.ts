// Decoding helpers for the two QR payloads the app issues:
// - Hostel invite (JoinQrSheet): <origin>/student/find-hostel?hostel=<id>
// - Member code (MyQrSheet):     <origin>/manager/members?assign=<userId>
// Both parsers also accept a bare id, so codes survive being copy-pasted.

function paramFromUrl(text: string, param: string): string | null {
  try {
    const url = new URL(text.trim());
    return url.searchParams.get(param);
  } catch {
    return null;
  }
}

const bareToken = (text: string): string | null => {
  const t = text.trim();
  return /^[A-Za-z0-9_-]+$/.test(t) ? t : null;
};

/** Extracts a hostel id from a scanned hostel-invite QR (or pasted link). */
export function parseHostelCode(text: string): string | null {
  return paramFromUrl(text, "hostel") ?? bareToken(text);
}

/** Extracts a member (user) id from a scanned member QR (or pasted link). */
export function parseMemberCode(text: string): string | null {
  return paramFromUrl(text, "assign") ?? bareToken(text);
}

/** The link encoded in a member's personal QR code. */
export function memberQrLink(origin: string, userId: string): string {
  return `${origin}/manager/members?assign=${userId}`;
}

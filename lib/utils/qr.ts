// Decoding helpers for the QR payloads the app issues:
// - Door QR (JoinQrSheet):   <origin>/h/<hostelId>   (also legacy
//   /student/find-hostel?hostel=<id>)
// - Member code (MyQrSheet): <origin>/manager/members?assign=<userId>
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

/** Extracts a hostel id from a scanned door QR (or pasted link) — the new
 * `/h/<id>` path, the legacy `?hostel=<id>` link, or a bare id. */
export function parseHostelCode(text: string): string | null {
  try {
    const path = new URL(text.trim()).pathname.match(/\/h\/([A-Za-z0-9_-]+)/);
    if (path) return path[1];
  } catch {
    // not a URL — fall through
  }
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

// Shared shape of the public (unauthenticated) hostel view returned by
// GET /api/public/hostel/[id] — used by the server helper that builds it and
// the client pages that render it. Types only: safe to import anywhere.

export interface PublicRoomView {
  /** Opaque room id (not sensitive) — lets the join form set a preferred room
   * without pulling any member data. */
  roomId: string;
  number: string;
  capacity: number;
  seatRent: number;
  facilities?: string[];
  freeNow: number;
  /** Seats opening from members' approved leave notices; freeFrom = leave date. */
  upcoming: { freeFrom: string }[];
}

export interface PublicHostelView {
  id: string;
  name: string;
  area: string;
  street?: string;
  /** Whether this is a boys' or girls' hostel; undefined for legacy records. */
  gender?: "boys" | "girls";
  verified: boolean;
  /** House rules, one per line; empty/undefined when none are set. */
  rules?: string;
  seatRentFrom?: number;
  facilities: string[];
  manager?: { name: string; phone: string };
  owner?: { name: string; phone: string };
  rooms: PublicRoomView[];
}

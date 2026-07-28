// Seat availability for a hostel's rooms — shared by the public QR landing
// page, the in-app find-hostel flow, and the join-request form so they all
// compute "free now" and "freeing soon" the same way.

import type { LeaveRequest, Room } from "../data";
import { today as todayStr } from "./date";

export interface RoomAvailability {
  roomId: string;
  number: string;
  capacity: number;
  /** Seats free right now (capacity − current occupants). */
  freeNow: number;
  /** Seats that will open because an occupant filed an approved leave notice —
   * one entry per leaving occupant, its `freeFrom` = their leave date. Sorted
   * soonest first. */
  upcoming: { freeFrom: string }[];
  /** True when the room has a seat now OR one opening from a leave notice. */
  selectable: boolean;
}

/**
 * Per-room availability. `leaves` are the hostel's leave requests; only
 * APPROVED ones with a future leave date count toward upcoming openings.
 */
export function hostelAvailability(
  rooms: Room[],
  leaves: LeaveRequest[],
  today: string = todayStr()
): RoomAvailability[] {
  const futureLeaveByUser = new Map<string, string>();
  for (const l of leaves) {
    if (l.status !== "approved") continue;
    if (l.leaveDate <= today) continue; // already gone → their seat is free now
    const existing = futureLeaveByUser.get(l.userId);
    if (!existing || l.leaveDate < existing) futureLeaveByUser.set(l.userId, l.leaveDate);
  }

  return rooms.map((r) => {
    const freeNow = Math.max(r.capacity - r.occupantIds.length, 0);
    const upcoming = r.occupantIds
      .map((uid) => futureLeaveByUser.get(uid))
      .filter((d): d is string => !!d)
      .sort()
      .map((freeFrom) => ({ freeFrom }));
    return {
      roomId: r.id,
      number: r.number,
      capacity: r.capacity,
      freeNow,
      upcoming,
      selectable: freeNow > 0 || upcoming.length > 0,
    };
  });
}

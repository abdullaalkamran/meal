"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useSession } from "@/lib/auth/SessionProvider";
import { repo } from "@/lib/data";
import { currentMonth, formatMonthLabel, formatShortDate } from "@/lib/utils/date";
import type { PublicRoomView } from "@/lib/types/publicHostel";

/**
 * Sends a join request with an optional preferred room and an intended join
 * month. Only rooms with a seat free now, or one opening from a member's leave
 * notice, can be picked — and the join month can't be earlier than that seat
 * opens. Requires a signed-in, member-less account.
 */
export function JoinRequestSheet({
  open,
  onClose,
  hostelId,
  hostelName,
  rooms,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string;
  hostelName: string;
  rooms: PublicRoomView[];
  onSent?: () => void;
}) {
  const { user } = useSession();
  const { toast } = useToast();
  const [roomId, setRoomId] = useState<string>("");
  const [month, setMonth] = useState<string>(currentMonth());
  const [busy, setBusy] = useState(false);

  const selectable = useMemo(
    () => rooms.filter((r) => r.freeNow > 0 || r.upcoming.length > 0),
    [rooms]
  );

  // Earliest month a given room can be joined: this month if a seat is free
  // now, else the month its soonest leave-freed seat opens.
  const earliestMonth = (r: PublicRoomView) =>
    r.freeNow > 0 ? currentMonth() : (r.upcoming[0]?.freeFrom ?? currentMonth()).slice(0, 7);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setRoomId("");
        setMonth(currentMonth());
        setBusy(false);
      });
    }
  }, [open]);

  const pickRoom = (r: PublicRoomView) => {
    setRoomId(r.roomId);
    const min = earliestMonth(r);
    setMonth((m) => (m < min ? min : m));
  };

  const selectedRoom = selectable.find((r) => r.roomId === roomId);
  const minMonth = selectedRoom ? earliestMonth(selectedRoom) : currentMonth();

  const submit = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      await repo.joinRequests.create({
        hostelId,
        userId: user.id,
        name: user.name,
        phone: user.phone,
        preferredRoomId: roomId || undefined,
        joinMonth: month,
      });
      toast(`Join request sent to ${hostelName}`);
      onSent?.();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not send the request");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Join ${hostelName}`}>
      <div className="mb-3 text-[10.5px] font-semibold text-text-secondary">
        Pick a preferred room and when you want to move in. The manager reviews your request
        and confirms your room.
      </div>

      <div className="mb-2 text-[10.5px] font-extrabold text-text-secondary">
        PREFERRED ROOM (optional)
      </div>
      {selectable.length === 0 ? (
        <div className="mb-4 rounded-btn bg-bg px-3 py-2.5 text-[11px] font-semibold text-text-secondary">
          No seats are free right now, and none are opening from a leave notice. You can still
          send a request with no room and the manager will assign one when a seat opens.
        </div>
      ) : (
        <div className="mb-4 flex flex-col gap-2">
          {selectable.map((r) => {
            const label =
              r.freeNow > 0
                ? `${r.freeNow} seat${r.freeNow === 1 ? "" : "s"} free now`
                : `Free from ${formatShortDate(r.upcoming[0].freeFrom)}`;
            return (
              <button
                key={r.roomId}
                type="button"
                onClick={() => pickRoom(r)}
                className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5 text-left"
              >
                <div className="min-w-0">
                  <div className="text-[12px] font-bold">Room {r.number}</div>
                  <div className="text-[9.5px] font-semibold text-text-secondary">
                    {label}
                    {r.facilities?.length ? ` · ${r.facilities.join(", ")}` : ""}
                  </div>
                </div>
                <Chip tone="primary" active={roomId === r.roomId}>
                  {roomId === r.roomId ? "Selected" : "Select"}
                </Chip>
              </button>
            );
          })}
        </div>
      )}

      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">MOVE-IN MONTH</div>
      <input
        type="month"
        value={month}
        min={minMonth}
        onChange={(e) => setMonth(e.target.value < minMonth ? minMonth : e.target.value)}
        className="mb-1 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
      />
      {selectedRoom && selectedRoom.freeNow === 0 && (
        <div className="mb-3 text-[9.5px] font-semibold text-orange">
          Room {selectedRoom.number} opens from {formatMonthLabel(minMonth)} — you can&rsquo;t
          move in earlier.
        </div>
      )}

      <Button fullWidth onClick={submit} disabled={busy || !user}>
        {busy ? "Sending…" : "Send join request"}
      </Button>
    </Sheet>
  );
}

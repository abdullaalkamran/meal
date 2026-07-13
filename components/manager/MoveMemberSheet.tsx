"use client";

import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { useToast } from "@/components/ui/Toast";
import { useRooms } from "@/hooks/useRooms";
import { repo, type User } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";

export function MoveMemberSheet({
  open,
  onClose,
  member,
}: {
  open: boolean;
  onClose: () => void;
  member: User | undefined;
}) {
  const { toast } = useToast();
  const rooms = useRooms(member?.hostelId);

  const move = async (roomId: string, roomNumber: string) => {
    if (!member) return;
    await repo.rooms.assignMember(roomId, member.id);
    toast(`${member.name.split(" ")[0]} moved to Room ${roomNumber}`);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={member ? `Move ${member.name.split(" ")[0]}` : "Move member"}>
      <div className="mb-3 text-[11px] font-semibold text-text-secondary">
        Pick a room to move this member into. Rooms already full are shown but disabled.
      </div>
      <div className="flex flex-col gap-2">
        {rooms.map((room) => {
          const isCurrent = room.id === member?.roomId;
          const free = room.capacity - room.occupantIds.length;
          const isFull = free <= 0 && !isCurrent;
          return (
            <button
              key={room.id}
              type="button"
              disabled={isFull || isCurrent}
              onClick={() => move(room.id, room.number)}
              className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5 text-left disabled:opacity-50"
            >
              <div className="min-w-0">
                <div className="text-[12px] font-bold">Room {room.number}</div>
                <div className="text-[9.5px] font-semibold text-text-secondary">
                  {room.occupantIds.length}/{room.capacity} occupied · {formatBDT(room.seatRent)}/seat
                </div>
              </div>
              <Chip tone="primary" active={isCurrent}>
                {isCurrent ? "Current" : isFull ? "Full" : `${free} free`}
              </Chip>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

"use client";

import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { useUsers } from "@/hooks/useUsers";
import { repo, type Room } from "@/lib/data";

export function AssignRoomSheet({
  open,
  onClose,
  hostelId,
  room,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | undefined;
  room: Room | null;
}) {
  const { toast } = useToast();
  const users = useUsers(hostelId).filter((u) => u.roomId !== room?.id);

  const assign = async (userId: string) => {
    if (!room) return;
    await repo.rooms.assignMember(room.id, userId);
    toast("Member assigned to room " + room.number);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={room ? `Assign to Room ${room.number}` : "Assign room"}>
      <div className="flex flex-col gap-2">
        {users.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => assign(u.id)}
            className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5 text-left"
          >
            <div className="text-[12px] font-bold">{u.name}</div>
            <div className="text-[10.5px] font-semibold text-text-secondary">{u.role}</div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { BedDouble, Check, ChefHat, ChevronRight, ShieldCheck } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { RoomFormSheet } from "@/components/manager/RoomFormSheet";
import { AssignStaffSheet } from "@/components/owner/AssignStaffSheet";
import { repo, type Hostel } from "@/lib/data";

function SetupStep({
  icon,
  title,
  detail,
  done,
  onClick,
}: {
  icon: typeof BedDouble;
  title: string;
  detail: string;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-card border border-border bg-card p-3 text-left shadow-chip"
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          done ? "bg-primary text-white" : "bg-primary-soft text-primary"
        }`}
      >
        <Icon icon={done ? Check : icon} size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-extrabold">{title}</div>
        <div className="text-[10px] font-semibold text-text-secondary">{detail}</div>
      </div>
      <Icon icon={ChevronRight} size={16} className="shrink-0 text-text-secondary" />
    </button>
  );
}

/** The guided flow after a hostel is created: add rooms → assign a manager →
 * assign a cook. Each step opens the relevant sheet inline and ticks off once
 * done; none is mandatory (the hostel already exists and the owner can run it
 * meanwhile), so the whole thing can be closed at any point. */
export function HostelSetupSheet({
  open,
  onClose,
  hostel: initialHostel,
}: {
  open: boolean;
  onClose: () => void;
  hostel: Hostel | null;
}) {
  const [hostel, setHostel] = useState<Hostel | null>(initialHostel);
  const [roomCount, setRoomCount] = useState(0);
  const [roomOpen, setRoomOpen] = useState(false);
  const [staffRole, setStaffRole] = useState<"manager" | "cook" | null>(null);

  const refresh = useCallback(async () => {
    if (!initialHostel) return;
    const [h, rooms] = await Promise.all([
      repo.hostels.getHostel(initialHostel.id),
      repo.rooms.listByHostel(initialHostel.id),
    ]);
    setHostel(h ?? initialHostel);
    setRoomCount(rooms.length);
  }, [initialHostel]);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setHostel(initialHostel);
      void refresh();
    });
  }, [open, initialHostel, refresh]);

  if (!hostel) return null;

  const hasRooms = roomCount > 0;
  const hasManager = !!hostel.managerId;
  const hasCook = !!hostel.cookId;

  return (
    <>
      <Sheet open={open} onClose={onClose} title={`Set up ${hostel.name}`}>
        <div className="mb-3 text-[11px] font-semibold text-text-secondary">
          {hostel.name} is created. Finish setting it up — you can do these now or later, and
          run the hostel yourself until a manager is assigned.
        </div>
        <div className="flex flex-col gap-2.5">
          <SetupStep
            icon={BedDouble}
            title="Add rooms"
            detail={hasRooms ? `${roomCount} room${roomCount === 1 ? "" : "s"} added` : "No rooms yet"}
            done={hasRooms}
            onClick={() => setRoomOpen(true)}
          />
          <SetupStep
            icon={ShieldCheck}
            title="Assign a manager"
            detail={hasManager ? "Manager assigned" : "Create an account or add an existing one"}
            done={hasManager}
            onClick={() => setStaffRole("manager")}
          />
          <SetupStep
            icon={ChefHat}
            title="Assign a cook"
            detail={hasCook ? "Cook assigned" : "Optional — create or add an existing cook"}
            done={hasCook}
            onClick={() => setStaffRole("cook")}
          />
        </div>
        <Button fullWidth onClick={onClose} className="mt-4">
          Done
        </Button>
      </Sheet>

      <RoomFormSheet
        open={roomOpen}
        onClose={() => {
          setRoomOpen(false);
          void refresh();
        }}
        hostelId={hostel.id}
        room={null}
      />
      <AssignStaffSheet
        open={!!staffRole}
        onClose={() => setStaffRole(null)}
        hostel={hostel}
        role={staffRole ?? "manager"}
        onAssigned={() => {
          setStaffRole(null);
          void refresh();
        }}
      />
    </>
  );
}

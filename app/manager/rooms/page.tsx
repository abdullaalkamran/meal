"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Pencil, UserMinus } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useUsers } from "@/hooks/useUsers";
import { useRooms } from "@/hooks/useRooms";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { RoomFormSheet } from "@/components/manager/RoomFormSheet";
import { MoveMemberSheet } from "@/components/manager/MoveMemberSheet";
import { AssignRoomSheet } from "@/components/manager/AssignRoomSheet";
import { repo, type Room, type User } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";

export default function ManagerRoomsPage() {
  const { activeHostelId, hostel } = useSession();
  const users = useUsers(activeHostelId);
  const rooms = useRooms(activeHostelId);
  const { toast } = useToast();
  const router = useRouter();

  const [roomForm, setRoomForm] = useState<{ open: boolean; room: Room | null }>({ open: false, room: null });
  const [moveMember, setMoveMember] = useState<User | null>(null);
  const [assignRoom, setAssignRoom] = useState<Room | null>(null);

  const userOf = (id: string) => users.find((u) => u.id === id);

  const totalSeats = rooms.reduce((sum, r) => sum + r.capacity, 0);
  const filledSeats = rooms.reduce((sum, r) => sum + r.occupantIds.length, 0);
  const monthlyRentRoll = rooms.reduce((sum, r) => sum + r.occupantIds.length * r.seatRent, 0);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[17.5px] font-extrabold tracking-tight">Rooms</div>
          <div className="text-[10.5px] font-semibold text-text-secondary">{hostel?.name}</div>
        </div>
        <button
          type="button"
          onClick={() => setRoomForm({ open: true, room: null })}
          className="min-h-10 cursor-pointer rounded-pill px-4 text-[11.5px] font-extrabold text-white"
          style={{ background: "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))" }}
        >
          + Add room
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Rooms", value: String(rooms.length), color: "" },
          { label: "Seats filled", value: `${filledSeats}/${totalSeats}`, color: "text-primary" },
          { label: "Rent roll", value: formatBDT(monthlyRentRoll), color: "text-blue", small: true },
        ].map((s) => (
          <Card key={s.label} className="text-center">
            <div className={`${s.small ? "text-[12.5px]" : "text-[16px]"} font-extrabold ${s.color}`}>
              {s.value}
            </div>
            <div className="mt-0.5 text-[9px] font-bold text-text-secondary">{s.label}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {rooms.length === 0 && (
          <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
            No rooms yet — add one to get started.
          </Card>
        )}
        {rooms.map((room) => {
          const free = room.capacity - room.occupantIds.length;
          return (
            <Card key={room.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-bg text-[12.5px] font-extrabold">
                  {room.number}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-extrabold">Room {room.number}</div>
                  <div className="text-[9.5px] font-semibold text-text-secondary">
                    {room.occupantIds.length}/{room.capacity} occupied · {formatBDT(room.seatRent)}/seat
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-pill px-2.5 py-1 text-[9.5px] font-extrabold ${
                      free === 0
                        ? "bg-bg text-text-secondary"
                        : room.occupantIds.length === 0
                          ? "bg-danger-soft text-danger"
                          : "bg-primary-soft text-primary"
                    }`}
                  >
                    {free === 0 ? "Full" : `${free} free`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRoomForm({ open: true, room })}
                    aria-label="Edit room"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-text-secondary"
                  >
                    <Icon icon={Pencil} size={13} />
                  </button>
                </div>
              </div>

              {room.facilities && room.facilities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {room.facilities.map((f) => (
                    <span key={f} className="rounded-pill bg-bg px-2.5 py-1 text-[9.5px] font-bold text-text-secondary">
                      {f}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-1.5 border-t border-border pt-2.5">
                {room.occupantIds.map((uid) => {
                  const u = userOf(uid);
                  if (!u) return null;
                  return (
                    <div key={uid} className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => router.push(`/manager/members/${uid}`)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <Avatar name={u.name} seed={u.avatarSeed} size={30} />
                        <div className="truncate text-[11.5px] font-bold">{u.name}</div>
                      </button>
                      {u.role !== "manager" && (
                        <>
                          <button
                            type="button"
                            onClick={() => setMoveMember(u)}
                            aria-label="Move member"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg text-text-secondary"
                          >
                            <Icon icon={ArrowLeftRight} size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await repo.rooms.vacate(uid);
                              toast(`${u.name.split(" ")[0]} vacated from Room ${room.number}`);
                            }}
                            aria-label="Vacate member"
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
                          >
                            <Icon icon={UserMinus} size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
                {free > 0 && (
                  <button
                    type="button"
                    onClick={() => setAssignRoom(room)}
                    className="mt-0.5 min-h-9 rounded-btn border border-dashed border-border text-[11px] font-extrabold text-text-secondary"
                  >
                    + Assign a member to this room
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <RoomFormSheet
        open={roomForm.open}
        onClose={() => setRoomForm({ open: false, room: null })}
        hostelId={activeHostelId}
        room={roomForm.room}
      />
      <MoveMemberSheet open={!!moveMember} onClose={() => setMoveMember(null)} member={moveMember ?? undefined} />
      <AssignRoomSheet
        open={!!assignRoom}
        onClose={() => setAssignRoom(null)}
        hostelId={activeHostelId}
        room={assignRoom}
      />
    </div>
  );
}

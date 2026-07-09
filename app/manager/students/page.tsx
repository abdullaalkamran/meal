"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useUsers } from "@/hooks/useUsers";
import { useRooms } from "@/hooks/useRooms";
import { useJoinRequests } from "@/hooks/useJoinRequests";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { AddMemberSheet } from "@/components/manager/AddMemberSheet";
import { AssignRoomSheet } from "@/components/manager/AssignRoomSheet";
import { repo, type Bill, type Room } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { currentMonth } from "@/lib/utils/date";

export default function ManagerStudentsPage() {
  const { activeHostelId, hostel } = useSession();
  // Cook is staff and owner is cross-hostel management — neither is a boarder
  // (no room/bill) — exclude both from the roster. Manager is included since
  // they're also a boarder (dual identity).
  const users = useUsers(activeHostelId).filter((u) => u.role !== "cook" && u.role !== "owner");
  const rooms = useRooms(activeHostelId);
  const joinRequests = useJoinRequests(activeHostelId).filter((r) => r.status === "pending");
  const { toast } = useToast();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [assignRoom, setAssignRoom] = useState<Room | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [billsByUser, setBillsByUser] = useState<Record<string, Bill>>({});

  const emptyRooms = rooms.filter((r) => r.occupantIds.length < r.capacity);

  useEffect(() => {
    if (!activeHostelId || users.length === 0) return;
    Promise.all(
      users.map(async (u) => [u.id, await repo.bills.getBill(activeHostelId, u.id, currentMonth())] as const)
    ).then((entries) => {
      const map: Record<string, Bill> = {};
      entries.forEach(([id, bill]) => {
        if (bill) map[id] = bill;
      });
      setBillsByUser(map);
    });
  }, [activeHostelId, users]);

  const totalRooms = rooms.length;
  const occupied = rooms.filter((r) => r.occupantIds.length > 0).length;
  const empty = totalRooms - occupied;

  const approve = async (requestId: string, roomId: string) => {
    await repo.joinRequests.decide(requestId, "approved", roomId);
    toast("Member approved and assigned");
    setApprovingId(null);
  };

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[17.5px] font-extrabold tracking-tight">Rooms &amp; members</div>
          <div className="text-[10.5px] font-semibold text-text-secondary">{hostel?.name}</div>
        </div>
        <button
          type="button"
          onClick={() => setAddMemberOpen(true)}
          className="min-h-10 cursor-pointer rounded-pill px-4 text-[11.5px] font-extrabold text-white"
          style={{ background: "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))" }}
        >
          + Add member
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        {[
          { label: "Total rooms", value: totalRooms, color: "" },
          { label: "Occupied", value: occupied, color: "text-primary" },
          { label: "Empty", value: empty, color: "text-danger" },
          { label: "Members", value: users.length, color: "text-blue" },
        ].map((s) => (
          <Card key={s.label} className="text-center">
            <div className={`text-[16px] font-extrabold ${s.color}`}>{s.value}</div>
            <div className="mt-0.5 text-[9px] font-bold text-text-secondary">{s.label}</div>
          </Card>
        ))}
      </div>

      {joinRequests.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-[13.5px] font-extrabold">
            New member requests
            <span className="rounded-pill bg-danger-soft px-2 py-0.5 text-[9.5px] font-extrabold text-danger">
              {joinRequests.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {joinRequests.map((r) => (
              <Card key={r.id}>
                <div className="mb-2 flex items-center gap-2.5">
                  <Avatar name={r.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-extrabold">{r.name}</div>
                    <div className="text-[10px] font-semibold text-text-secondary">{r.phone}</div>
                  </div>
                </div>
                {approvingId === r.id ? (
                  <div className="flex flex-wrap gap-1.5">
                    {emptyRooms.map((room) => (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => approve(r.id, room.id)}
                        className="rounded-pill bg-primary-soft px-3 py-1.5 text-[10.5px] font-extrabold text-primary"
                      >
                        Room {room.number}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setApprovingId(r.id)}
                      className="min-h-10 flex-1 cursor-pointer rounded-btn bg-primary text-[11.5px] font-extrabold text-white"
                    >
                      Approve &amp; assign room
                    </button>
                    <button
                      type="button"
                      onClick={() => repo.joinRequests.decide(r.id, "denied")}
                      className="min-h-10 flex-1 cursor-pointer rounded-btn border border-border text-[11.5px] font-extrabold"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between text-[13.5px] font-extrabold">
          Rooms
          <span className="text-[10px] font-semibold text-text-secondary">
            {empty} empty &middot; tap to assign
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {rooms.map((room) => {
            const isEmpty = room.occupantIds.length === 0;
            const isFull = room.occupantIds.length >= room.capacity;
            const occupantNames = room.occupantIds
              .map((id) => users.find((u) => u.id === id)?.name.split(" ")[0])
              .filter(Boolean)
              .join(" · ");
            return (
              <button
                key={room.id}
                type="button"
                onClick={() =>
                  isEmpty
                    ? setAssignRoom(room)
                    : toast(
                        `Room ${room.number}: ${room.occupantIds
                          .map((id) => users.find((u) => u.id === id)?.name ?? id)
                          .join(", ")}`
                      )
                }
                className="flex items-center gap-3 rounded-card border border-border bg-card p-3 text-left shadow-chip"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-bg text-[11.5px] font-extrabold">
                  {room.number}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] font-extrabold">{occupantNames || "No members assigned"}</div>
                  <div className="text-[9.5px] font-semibold text-text-secondary">
                    {room.occupantIds.length}/{room.capacity} &middot; Room {room.number}
                  </div>
                </div>
                <div
                  className={`rounded-pill px-2.5 py-1 text-[9.5px] font-extrabold ${
                    isEmpty
                      ? "bg-danger-soft text-danger"
                      : isFull
                        ? "bg-bg text-text-secondary"
                        : "bg-primary-soft text-primary"
                  }`}
                >
                  {isEmpty ? "Empty" : isFull ? "Full" : `${room.capacity - room.occupantIds.length} free`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-[13.5px] font-extrabold">
          Members
          <span className="text-[10.5px] font-semibold text-text-secondary">{users.length}</span>
        </div>
        <div className="flex flex-col gap-2">
          {users.map((u) => {
            const bill = billsByUser[u.id];
            const due = bill ? bill.grandTotal - bill.paid : 0;
            const room = rooms.find((r) => r.id === u.roomId);
            return (
              <Card key={u.id} className="flex items-center gap-3">
                <Avatar name={u.name} seed={u.avatarSeed} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] font-extrabold">{u.name}</div>
                  <div className="text-[10px] font-semibold text-text-secondary">
                    {room ? `Room ${room.number}` : "Unassigned"}
                    {bill ? ` · ${bill.mealsCount} meals` : ""}
                  </div>
                </div>
                <div className={`text-[11.5px] font-extrabold ${due > 0 ? "text-danger" : "text-primary"}`}>
                  {formatBDT(due)}
                  <div className="text-right text-[9px] font-semibold text-text-secondary">due</div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <AddMemberSheet
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        hostelId={activeHostelId}
      />
      <AssignRoomSheet
        open={!!assignRoom}
        onClose={() => setAssignRoom(null)}
        hostelId={activeHostelId}
        room={assignRoom}
      />
    </div>
  );
}

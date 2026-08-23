"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, ChevronRight, Phone, QrCode, RefreshCw, ScrollText, Star } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useUsers } from "@/hooks/useUsers";
import { useRooms } from "@/hooks/useRooms";
import { useJoinRequests } from "@/hooks/useJoinRequests";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { AddMemberSheet } from "@/components/manager/AddMemberSheet";
import { JoinQrSheet } from "@/components/hostel/JoinQrSheet";
import { EditHostelRulesSheet } from "@/components/hostel/EditHostelRulesSheet";
import { AssignStaffSheet } from "@/components/owner/AssignStaffSheet";
import { repo, type Bill } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { currentMonth } from "@/lib/utils/date";

/** The member-roster management screen, shared by the manager page and the
 * owner's native members page — `memberHref` keeps detail links inside
 * whichever section is rendering it. */
export function MembersScreen({ memberHref }: { memberHref: (userId: string) => string }) {
  const { activeHostelId, hostel } = useSession();
  const hostelUsers = useUsers(activeHostelId);
  const cook = hostelUsers.find((u) => u.role === "cook");
  // Cook is staff and owner is cross-hostel management — neither is a boarder.
  // Manager is included since they're also a boarder (dual identity).
  const members = hostelUsers.filter((u) => u.role !== "cook" && u.role !== "owner");
  const rooms = useRooms(activeHostelId);
  const joinRequests = useJoinRequests(activeHostelId).filter((r) => r.status === "pending");
  const { toast } = useToast();
  const router = useRouter();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState<string | undefined>(undefined);
  const [qrOpen, setQrOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [assignCookOpen, setAssignCookOpen] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [billsByUser, setBillsByUser] = useState<Record<string, Bill>>({});
  const [formerBills, setFormerBills] = useState<Record<string, Bill>>({});
  const [formerSearch, setFormerSearch] = useState("");

  const active = members.filter((u) => !u.banned);
  const banned = members.filter((u) => u.banned);
  const emptyRooms = rooms.filter((r) => r.occupantIds.length < r.capacity);

  // `members` is a fresh `.filter()` array every render, so depend on a stable
  // string of member ids (not the array reference) — otherwise the effect
  // re-fires each render (setState → re-render → new array → effect…), an
  // infinite loop that keeps the page re-rendering and prevents member-card
  // clicks from landing. One listByHostel call also beats N getBill calls.
  const memberIdsKey = members.map((u) => u.id).join(",");
  useEffect(() => {
    if (!activeHostelId) return;
    repo.bills.listByHostel(activeHostelId, currentMonth()).then((bills) => {
      const map: Record<string, Bill> = {};
      for (const b of bills) map[b.userId] = b;
      setBillsByUser(map);
    });
  }, [activeHostelId, memberIdsKey]);

  // Former members' final bills can be from a PAST month, so fetch each one's
  // latest bill directly (the current-month map above won't have them). Their
  // closing balance = grandTotal − paid (a due to collect or a credit owed).
  const bannedIdsKey = banned.map((u) => u.id).join(",");
  useEffect(() => {
    if (!activeHostelId) return;
    let cancelled = false;
    // Promise.all([]) handles "no former members" without a synchronous
    // setState in the effect body.
    Promise.all(
      banned.map((u) =>
        repo.bills.getLatestForUser(activeHostelId, u.id).then((b) => [u.id, b] as const)
      )
    ).then((entries) => {
      if (cancelled) return;
      const map: Record<string, Bill> = {};
      for (const [id, b] of entries) if (b) map[id] = b;
      setFormerBills(map);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHostelId, bannedIdsKey]);

  // A member QR scanned with a plain camera app opens this page as
  // /manager/members?assign=<userId> — jump straight to assigning them.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("assign");
    if (id) {
      queueMicrotask(() => {
        setAssignUserId(id);
        setAddMemberOpen(true);
      });
    }
  }, []);

  const approve = async (requestId: string, roomId: string) => {
    await repo.joinRequests.decide(requestId, "approved", roomId);
    toast("Member approved and assigned");
    setApprovingId(null);
  };

  const removeCook = async () => {
    if (!activeHostelId) return;
    await repo.hostels.assignCook(activeHostelId, { mode: "remove" });
    toast("Cook removed");
  };

  const roomOf = (id: string | undefined) => rooms.find((r) => r.id === id);

  const totalDue = active.reduce((sum, u) => {
    const bill = billsByUser[u.id];
    return sum + (bill ? Math.max(bill.grandTotal - bill.paid, 0) : 0);
  }, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[17.5px] font-extrabold tracking-tight">Members</div>
          <div className="text-[10.5px] font-semibold text-text-secondary">{hostel?.name}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRulesOpen(true)}
            aria-label="Hostel rules"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill border border-border bg-card shadow-chip"
          >
            <Icon icon={ScrollText} size={16} className="text-text-secondary" />
          </button>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            aria-label="QR invite"
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-pill border border-border bg-card shadow-chip"
          >
            <Icon icon={QrCode} size={16} className="text-primary" />
          </button>
          <button
            type="button"
            onClick={() => setAddMemberOpen(true)}
            className="min-h-10 cursor-pointer rounded-pill px-4 text-[11.5px] font-extrabold text-white"
            style={{ background: "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))" }}
          >
            + Add member
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Active", value: active.length, color: "text-primary" },
          { label: "Banned", value: banned.length, color: banned.length > 0 ? "text-danger" : "" },
          { label: "Total due", value: formatBDT(totalDue), color: totalDue > 0 ? "text-danger" : "", small: true },
        ].map((s) => (
          <Card key={s.label} className="text-center">
            <div className={`${s.small ? "text-[12.5px]" : "text-[16px]"} font-extrabold ${s.color}`}>
              {s.value}
            </div>
            <div className="mt-0.5 text-[9px] font-bold text-text-secondary">{s.label}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
          Kitchen staff
        </div>
        <div className="flex items-center gap-3">
          {cook ? (
            <Avatar name={cook.name} seed={cook.avatarSeed} photo={cook.avatarImage} size={38} />
          ) : (
            <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-bg text-text-secondary">
              <Icon icon={ChefHat} size={16} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-extrabold">{cook?.name ?? "No cook assigned"}</div>
            <div className="text-[10px] font-semibold text-text-secondary">{cook?.phone ?? "—"}</div>
          </div>
          {cook && (
            <a
              href={`tel:${cook.phone}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
            >
              <Icon icon={Phone} size={15} />
            </a>
          )}
          {cook && (
            <button
              type="button"
              onClick={removeCook}
              className="rounded-pill bg-danger-soft px-2.5 py-1.5 text-[10px] font-extrabold text-danger"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={() => setAssignCookOpen(true)}
            className="flex items-center gap-1 rounded-pill bg-bg px-2.5 py-1.5 text-[10px] font-extrabold text-primary shadow-chip"
          >
            <Icon icon={RefreshCw} size={11} /> {cook ? "Replace" : "Assign"}
          </button>
        </div>
      </Card>

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
                    {emptyRooms.length === 0 && (
                      <div className="text-[10.5px] font-semibold text-text-secondary">
                        No free rooms — add or free a seat first.
                      </div>
                    )}
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
          Active members
          <span className="text-[10.5px] font-semibold text-text-secondary">{active.length}</span>
        </div>
        <div className="flex flex-col gap-2">
          {active.map((u) => {
            const bill = billsByUser[u.id];
            const due = bill ? bill.grandTotal - bill.paid : 0;
            const room = roomOf(u.roomId);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => router.push(memberHref(u.id))}
                className="flex items-center gap-3 rounded-card border border-border bg-card p-3 text-left shadow-chip"
              >
                <Avatar name={u.name} seed={u.avatarSeed} photo={u.avatarImage} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="truncate text-[12px] font-extrabold">{u.name}</div>
                    {u.role === "manager" && (
                      <span className="rounded-pill bg-blue-soft px-1.5 py-0.5 text-[8.5px] font-extrabold text-blue">
                        Manager
                      </span>
                    )}
                    {typeof u.managerRating === "number" && (
                      <span className="flex items-center gap-0.5 text-[9.5px] font-extrabold text-orange">
                        <Icon icon={Star} size={10} className="fill-orange" />
                        {u.managerRating}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-semibold text-text-secondary">
                    {room ? `Room ${room.number}` : "Unassigned"}
                    {bill ? ` · ${bill.mealsCount} meals` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-[11.5px] font-extrabold ${due > 0 ? "text-danger" : "text-primary"}`}>
                    {formatBDT(Math.abs(due))}
                  </div>
                  <div className="text-[9px] font-semibold text-text-secondary">{due > 0 ? "due" : "credit"}</div>
                </div>
                <Icon icon={ChevronRight} size={16} className="shrink-0 text-text-secondary" />
              </button>
            );
          })}
        </div>
      </div>

      {banned.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-[13.5px] font-extrabold">
            Left this hostel
            <span className="rounded-pill bg-danger-soft px-2 py-0.5 text-[9.5px] font-extrabold text-danger">
              {banned.length}
            </span>
          </div>
          {banned.length > 4 && (
            <input
              value={formerSearch}
              onChange={(e) => setFormerSearch(e.target.value)}
              placeholder="Search by name or phone"
              className="mb-2 w-full rounded-btn border border-border bg-transparent px-3 py-2 text-[12px] font-semibold"
            />
          )}
          <div className="flex flex-col gap-2">
            {banned
              .filter((u) => {
                const q = formerSearch.trim().toLowerCase();
                return !q || u.name.toLowerCase().includes(q) || (u.phone ?? "").includes(q);
              })
              .map((u) => {
                const bill = formerBills[u.id];
                const balance = bill ? bill.grandTotal - bill.paid : 0;
                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 rounded-card border border-border bg-card p-3"
                  >
                    <Avatar name={u.name} seed={u.avatarSeed} photo={u.avatarImage} size={38} />
                    <button
                      type="button"
                      onClick={() => router.push(memberHref(u.id))}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-[12px] font-extrabold">{u.name}</div>
                      <div className="text-[10px] font-semibold text-text-secondary">
                        {u.phone ?? "—"}
                        {balance > 0
                          ? " · owes this hostel"
                          : balance < 0
                            ? " · hostel owes them"
                            : bill
                              ? " · settled"
                              : ""}
                      </div>
                    </button>
                    {bill && balance !== 0 && (
                      <div className="shrink-0 text-right">
                        <div
                          className={`text-[11.5px] font-extrabold ${balance > 0 ? "text-danger" : "text-primary"}`}
                        >
                          {balance > 0 ? `Due ${formatBDT(balance)}` : `Credit ${formatBDT(-balance)}`}
                        </div>
                        <div className="text-[8.5px] font-semibold text-text-secondary">to settle</div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        await repo.users.setBanned(u.id, false);
                        toast(`${u.name.split(" ")[0]} un-banned`);
                      }}
                      className="shrink-0 rounded-pill bg-primary-soft px-3 py-1.5 text-[10.5px] font-extrabold text-primary"
                    >
                      Un-ban
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <AddMemberSheet
        open={addMemberOpen}
        onClose={() => {
          setAddMemberOpen(false);
          setAssignUserId(undefined);
        }}
        hostelId={activeHostelId}
        initialScanUserId={assignUserId}
      />
      <JoinQrSheet
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        hostelId={activeHostelId}
        hostelName={hostel?.name}
      />
      <EditHostelRulesSheet
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        hostelId={activeHostelId}
        onSaved={() => toast("Hostel rules saved")}
      />
      <AssignStaffSheet
        open={assignCookOpen}
        onClose={() => setAssignCookOpen(false)}
        hostel={hostel ?? null}
        role="cook"
        onAssigned={(name) => toast(`${name} assigned as cook`)}
      />
    </div>
  );
}

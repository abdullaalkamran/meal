"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Ban, CreditCard, DoorOpen, ShoppingBag, UserPlus } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useUsers } from "@/hooks/useUsers";
import { useMealStops } from "@/hooks/useMealStops";
import { useGuestMeals } from "@/hooks/useGuestMeals";
import { useCookLeaveRequests } from "@/hooks/useCookLeaveRequests";
import { useTransfers } from "@/hooks/useTransfers";
import { useJoinRequests } from "@/hooks/useJoinRequests";
import { useLeaveRequests } from "@/hooks/useLeaveRequests";
import { useRooms } from "@/hooks/useRooms";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { repo, type Bill, type BillTarget, type Payment, type ShoppingCost } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { currentMonth, formatMonthLabel } from "@/lib/utils/date";
import { PermissionGate } from "@/components/manager/PermissionGate";
import { useActualMealRate } from "@/hooks/useActualMealRate";

const TARGET_LABEL: Record<BillTarget, string> = {
  previousBalance: "Previous balance",
  mealCost: "Meal cost",
  roomRent: "Room rent",
  serviceCharge: "Service charge",
  cookSalary: "Cook salary",
};

function ManagerApprovalsPage() {
  const { user, hostel, activeHostelId } = useSession();
  const actualRate = useActualMealRate(activeHostelId);
  const users = useUsers(activeHostelId);
  const mealStops = useMealStops(activeHostelId).filter((r) => r.status === "pending");
  const guestMeals = useGuestMeals(activeHostelId).filter((r) => r.status === "pending");
  const cookLeave = useCookLeaveRequests(activeHostelId).filter((r) => r.status === "pending");
  // A member requesting to leave THIS hostel lands here first (stage
  // "requested"); approving passes it to the owner (stage "owner_review").
  const transfersOut = useTransfers(activeHostelId).filter(
    (t) => t.fromHostelId === activeHostelId && t.stage === "requested"
  );
  const joinRequests = useJoinRequests(activeHostelId).filter((r) => r.status === "pending");
  const leaveRequests = useLeaveRequests(activeHostelId).filter((r) => r.status === "pending");
  const rooms = useRooms(activeHostelId);
  const emptyRooms = rooms.filter((r) => r.occupantIds.length < r.capacity);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  // Locks a guest-meal request's row while its decide() call is in flight —
  // without this, a double-click applied the guest count twice.
  const [decidingGuestMealId, setDecidingGuestMealId] = useState<string | null>(null);
  // Same in-flight lock, shared across every other approve/decide button below
  // (join, meal-stop, cook-leave, transfer, leave, payment, shopping-cost) —
  // only one of these is ever mid-flight at a time, so one shared id suffices.
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [shoppingCosts, setShoppingCosts] = useState<ShoppingCost[]>([]);
  const { toast } = useToast();

  const refreshPayments = () => {
    if (!activeHostelId) return;
    repo.bills.listPendingVerification(activeHostelId, currentMonth()).then(setPayments);
    repo.bills.listByHostel(activeHostelId, currentMonth()).then(setBills);
  };
  const refreshShoppingCosts = () => {
    if (!activeHostelId) return;
    repo.shoppingCosts.listByHostel(activeHostelId).then(setShoppingCosts);
  };

  useEffect(refreshPayments, [activeHostelId]);
  useEffect(refreshShoppingCosts, [activeHostelId]);

  const pendingShoppingCosts = shoppingCosts.filter((c) => c.status === "pending");

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const billUserName = (billId: string) => {
    const bill = bills.find((b) => b.id === billId);
    return bill ? nameOf(bill.userId) : "Member";
  };
  const approveJoin = async (requestId: string, roomId: string) => {
    setDecidingId(requestId);
    try {
      await repo.joinRequests.decide(requestId, "approved", roomId);
      toast("Member approved and assigned");
      setApprovingId(null);
    } finally {
      setDecidingId(null);
    }
  };
  const declineJoin = async (requestId: string) => {
    setDecidingId(requestId);
    try {
      await repo.joinRequests.decide(requestId, "denied");
    } finally {
      setDecidingId(null);
    }
  };

  const total =
    joinRequests.length +
    mealStops.length +
    guestMeals.length +
    cookLeave.length +
    payments.length +
    transfersOut.length +
    pendingShoppingCosts.length +
    leaveRequests.length;

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Approvals</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          Review member requests for {hostel?.name}
        </div>
      </div>

      <Card>
        <div className="mb-3 flex items-baseline gap-1.5">
          <div className="text-[22px] font-extrabold">{total}</div>
          <div className="text-[11px] font-semibold text-text-secondary">awaiting your review</div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-btn bg-blue-soft p-2.5 text-center">
            <div className="text-[14px] font-extrabold text-blue">{mealStops.length}</div>
            <div className="text-[9px] font-bold text-text-secondary">Meal requests</div>
          </div>
          <div className="rounded-btn bg-orange-soft p-2.5 text-center">
            <div className="text-[14px] font-extrabold text-orange">{guestMeals.length}</div>
            <div className="text-[9px] font-bold text-text-secondary">Guest meals</div>
          </div>
          <div className="rounded-btn bg-primary-soft p-2.5 text-center">
            <div className="text-[14px] font-extrabold text-primary">{payments.length}</div>
            <div className="text-[9px] font-bold text-text-secondary">Payments</div>
          </div>
        </div>
      </Card>

      {joinRequests.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon icon={UserPlus} size={13} />
            </div>
            <div className="text-[13.5px] font-extrabold">New member requests</div>
          </div>
          <div className="flex flex-col gap-2">
            {joinRequests.map((r) => (
              <Card key={r.id}>
                <div className="mb-2 flex items-center gap-2.5">
                  <Avatar name={r.name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-extrabold">{r.name}</div>
                    <div className="text-[10px] font-semibold text-text-secondary">{r.phone}</div>
                    {(r.preferredRoomId || r.joinMonth) && (
                      <div className="mt-0.5 text-[9.5px] font-bold text-primary">
                        {r.preferredRoomId
                          ? `Wants Room ${rooms.find((x) => x.id === r.preferredRoomId)?.number ?? "?"}`
                          : ""}
                        {r.preferredRoomId && r.joinMonth ? " · " : ""}
                        {r.joinMonth ? `from ${formatMonthLabel(r.joinMonth)}` : ""}
                      </div>
                    )}
                  </div>
                  <Chip tone="orange" active>
                    Pending
                  </Chip>
                </div>
                {approvingId === r.id ? (
                  <div className="flex flex-wrap gap-1.5">
                    {emptyRooms.length === 0 && (
                      <div className="text-[10.5px] font-semibold text-text-secondary">
                        No free rooms — add or free a seat first.
                      </div>
                    )}
                    {/* Preferred room (if it currently has a free seat) floats first. */}
                    {[...emptyRooms]
                      .sort((a, b) => Number(b.id === r.preferredRoomId) - Number(a.id === r.preferredRoomId))
                      .map((room) => {
                        const preferred = room.id === r.preferredRoomId;
                        return (
                          <button
                            key={room.id}
                            type="button"
                            disabled={decidingId === r.id}
                            onClick={() => approveJoin(r.id, room.id)}
                            className={`rounded-pill px-3 py-1.5 text-[10.5px] font-extrabold disabled:cursor-not-allowed disabled:opacity-50 ${
                              preferred ? "bg-primary text-white" : "bg-primary-soft text-primary"
                            }`}
                          >
                            Room {room.number}
                            {preferred ? " · preferred" : ""}
                          </button>
                        );
                      })}
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
                      disabled={decidingId === r.id}
                      onClick={() => declineJoin(r.id)}
                      className="min-h-10 flex-1 cursor-pointer rounded-btn border border-border text-[11.5px] font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
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

      {mealStops.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-soft text-blue">
              <Icon icon={Ban} size={13} />
            </div>
            <div className="text-[13.5px] font-extrabold">Meal requests</div>
          </div>
          <div className="flex flex-col gap-2">
            {mealStops.map((r) => (
              <Card key={r.id}>
                <div className="mb-2 flex items-center gap-2.5">
                  <Avatar name={nameOf(r.userId)} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-extrabold">{nameOf(r.userId)}</div>
                    <div className="text-[10px] font-semibold text-text-secondary">
                      {r.meals.join(" + ")} · {r.dateFrom}
                      {r.dateTo !== r.dateFrom ? ` – ${r.dateTo}` : ""}
                    </div>
                  </div>
                  <Chip tone={r.desiredOn ? "primary" : "orange"} active>
                    {r.desiredOn ? "Turn on" : "Turn off"}
                  </Chip>
                </div>
                {r.reason && (
                  <div className="mb-2 rounded-btn bg-bg px-3 py-2 text-[11px] font-semibold italic text-text-secondary">
                    &ldquo;{r.reason}&rdquo;
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={decidingId === r.id}
                    onClick={async () => {
                      setDecidingId(r.id);
                      try {
                        await repo.mealStops.decide(r.id, "approved");
                      } finally {
                        setDecidingId(null);
                      }
                    }}
                    className="min-h-10 flex-1 cursor-pointer rounded-btn bg-primary text-[11.5px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={decidingId === r.id}
                    onClick={async () => {
                      setDecidingId(r.id);
                      try {
                        await repo.mealStops.decide(r.id, "denied");
                      } finally {
                        setDecidingId(null);
                      }
                    }}
                    className="min-h-10 flex-1 cursor-pointer rounded-btn border border-border text-[11.5px] font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {guestMeals.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-soft text-orange">
              <Icon icon={UserPlus} size={13} />
            </div>
            <div className="text-[13.5px] font-extrabold">Guest meals</div>
          </div>
          <div className="flex flex-col gap-2">
            {guestMeals.map((r) => (
              <Card key={r.id}>
                <div className="mb-2 flex items-center gap-2.5">
                  <Avatar name={nameOf(r.userId)} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-extrabold">{nameOf(r.userId)}</div>
                    <div className="text-[10px] font-semibold text-text-secondary">
                      {r.meal} · {r.date} · {r.qty < 0 ? "Remove" : "Add"} {Math.abs(r.qty)} guest
                      {Math.abs(r.qty) === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className={`text-[12.5px] font-extrabold ${r.qty < 0 ? "text-primary" : ""}`}>
                    {r.qty < 0 ? "−" : "~"}
                    {formatBDT(Math.abs(actualRate.rate * r.qty))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={decidingGuestMealId === r.id}
                    onClick={async () => {
                      setDecidingGuestMealId(r.id);
                      try {
                        await repo.guestMeals.decide(r.id, "approved");
                      } finally {
                        setDecidingGuestMealId(null);
                      }
                    }}
                    className="min-h-10 flex-1 cursor-pointer rounded-btn bg-primary text-[11.5px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={decidingGuestMealId === r.id}
                    onClick={async () => {
                      setDecidingGuestMealId(r.id);
                      try {
                        await repo.guestMeals.decide(r.id, "denied");
                      } finally {
                        setDecidingGuestMealId(null);
                      }
                    }}
                    className="min-h-10 flex-1 cursor-pointer rounded-btn border border-border text-[11.5px] font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {cookLeave.length > 0 && (
        <div>
          <div className="mb-2 text-[13.5px] font-extrabold">Cook leave</div>
          <div className="flex flex-col gap-2">
            {cookLeave.map((r) => (
              <Card key={r.id}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[12px] font-bold">
                    {r.dateFrom} → {r.dateTo}
                  </div>
                  <Chip tone="orange" active>
                    {r.scope === "full-day" ? "Full day" : "Partial"}
                  </Chip>
                </div>
                <div className="mb-2 rounded-btn bg-bg px-3 py-2 text-[11px] font-semibold italic text-text-secondary">
                  &ldquo;{r.reason}&rdquo;
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={decidingId === r.id}
                    onClick={async () => {
                      if (!user) return;
                      setDecidingId(r.id);
                      try {
                        await repo.cookLeave.decide(r.id, "approved", user.id);
                      } finally {
                        setDecidingId(null);
                      }
                    }}
                    className="min-h-10 flex-1 cursor-pointer rounded-btn bg-primary text-[11.5px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={decidingId === r.id}
                    onClick={async () => {
                      if (!user) return;
                      setDecidingId(r.id);
                      try {
                        await repo.cookLeave.decide(r.id, "denied", user.id);
                      } finally {
                        setDecidingId(null);
                      }
                    }}
                    className="min-h-10 flex-1 cursor-pointer rounded-btn border border-border text-[11.5px] font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {transfersOut.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7C6CF6]/10 text-[#7C6CF6]">
              <Icon icon={ArrowLeftRight} size={13} />
            </div>
            <div className="text-[13.5px] font-extrabold">Hostel transfers</div>
          </div>
          <div className="flex flex-col gap-2">
            {transfersOut.map((t) => (
              <Card key={t.id}>
                <div className="mb-2 rounded-btn bg-bg px-3 py-2 text-[11px] font-semibold italic text-text-secondary">
                  &ldquo;{t.reason}&rdquo;
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={decidingId === t.id}
                    onClick={async () => {
                      if (!user) return;
                      setDecidingId(t.id);
                      try {
                        await repo.transfers.advance(t.id, user.id, true, "requested");
                      } finally {
                        setDecidingId(null);
                      }
                    }}
                    className="min-h-10 flex-1 cursor-pointer rounded-btn bg-primary text-[11.5px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={decidingId === t.id}
                    onClick={async () => {
                      if (!user) return;
                      setDecidingId(t.id);
                      try {
                        await repo.transfers.advance(t.id, user.id, false, "requested");
                      } finally {
                        setDecidingId(null);
                      }
                    }}
                    className="min-h-10 flex-1 cursor-pointer rounded-btn border border-border text-[11.5px] font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {leaveRequests.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-soft text-orange">
              <Icon icon={DoorOpen} size={13} />
            </div>
            <div className="text-[13.5px] font-extrabold">Leave requests</div>
          </div>
          <div className="flex flex-col gap-2">
            {leaveRequests.map((r) => (
              <Card key={r.id}>
                <div className="mb-2 flex items-center gap-2.5">
                  <Avatar name={nameOf(r.userId)} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-extrabold">{nameOf(r.userId)}</div>
                    <div className="text-[10px] font-semibold text-text-secondary">
                      Leaving on {r.leaveDate}
                    </div>
                  </div>
                  <Chip tone="orange" active>
                    Pending
                  </Chip>
                </div>
                {r.reason && (
                  <div className="mb-2 rounded-btn bg-bg px-3 py-2 text-[11px] font-semibold italic text-text-secondary">
                    &ldquo;{r.reason}&rdquo;
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={decidingId === r.id}
                    onClick={async () => {
                      if (!user) return;
                      setDecidingId(r.id);
                      try {
                        await repo.leaveRequests.decide(r.id, "approved", user.id);
                      } finally {
                        setDecidingId(null);
                      }
                    }}
                    className="min-h-10 flex-1 cursor-pointer rounded-btn bg-primary text-[11.5px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={decidingId === r.id}
                    onClick={async () => {
                      if (!user) return;
                      setDecidingId(r.id);
                      try {
                        await repo.leaveRequests.decide(r.id, "denied", user.id);
                      } finally {
                        setDecidingId(null);
                      }
                    }}
                    className="min-h-10 flex-1 cursor-pointer rounded-btn border border-border text-[11.5px] font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {payments.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon icon={CreditCard} size={13} />
            </div>
            <div className="text-[13.5px] font-extrabold">Payment verification</div>
          </div>
          <div className="flex flex-col gap-2">
            {payments.map((p) => (
              <Card key={p.id}>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-extrabold">
                      {p.method} · {billUserName(p.billId)} · {formatBDT(p.amount)}
                    </div>
                    <div className="text-[10px] font-semibold text-text-secondary">
                      For {p.targets.map((t) => TARGET_LABEL[t]).join(", ")}
                      {p.reference ? ` · ${p.reference}` : ""}
                      {p.senderNumber ? ` · Sent from ${p.senderNumber}` : ""}
                    </div>
                  </div>
                  <Chip tone="orange" active>
                    Pending
                  </Chip>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={decidingId === p.id}
                    onClick={async () => {
                      setDecidingId(p.id);
                      try {
                        await repo.bills.decidePayment(p.id, "verified");
                        toast("Payment verified");
                        refreshPayments();
                      } finally {
                        setDecidingId(null);
                      }
                    }}
                    className="min-h-10 flex-1 cursor-pointer rounded-btn bg-primary text-[11.5px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Verify payment
                  </button>
                  <button
                    type="button"
                    disabled={decidingId === p.id}
                    onClick={async () => {
                      setDecidingId(p.id);
                      try {
                        await repo.bills.decidePayment(p.id, "declined");
                        toast("Payment declined");
                        refreshPayments();
                      } finally {
                        setDecidingId(null);
                      }
                    }}
                    className="min-h-10 flex-1 cursor-pointer rounded-btn border border-border text-[11.5px] font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {pendingShoppingCosts.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-soft text-orange">
              <Icon icon={ShoppingBag} size={13} />
            </div>
            <div className="text-[13.5px] font-extrabold">Shopping expenses</div>
          </div>
          <div className="flex flex-col gap-2">
            {pendingShoppingCosts.map((c) => (
              <Card key={c.id}>
                <div className="mb-2 flex items-center gap-2.5">
                  <Avatar name={nameOf(c.userId)} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-extrabold">
                      {nameOf(c.userId)} · {formatBDT(c.amount)}
                    </div>
                    <div className="truncate text-[10px] font-semibold text-text-secondary">
                      {c.items || "No items listed"}
                    </div>
                  </div>
                  <Chip tone="orange" active>
                    Pending
                  </Chip>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={decidingId === c.id}
                    onClick={async () => {
                      setDecidingId(c.id);
                      try {
                        await repo.shoppingCosts.decide(c.id, "approved");
                        toast("Shopping expense approved");
                        refreshShoppingCosts();
                      } finally {
                        setDecidingId(null);
                      }
                    }}
                    className="min-h-10 flex-1 cursor-pointer rounded-btn bg-primary text-[11.5px] font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={decidingId === c.id}
                    onClick={async () => {
                      setDecidingId(c.id);
                      try {
                        await repo.shoppingCosts.decide(c.id, "denied");
                        toast("Shopping expense declined");
                        refreshShoppingCosts();
                      } finally {
                        setDecidingId(null);
                      }
                    }}
                    className="min-h-10 flex-1 cursor-pointer rounded-btn border border-border text-[11.5px] font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {total === 0 && (
        <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
          Nothing pending — all caught up.
        </Card>
      )}
    </div>
  );
}

// Owner-configured permission gate: real managers need the "approvals" flag.
export default function GatedManagerApprovalsPage() {
  return (
    <PermissionGate permission="approvals" label="The approvals inbox">
      <ManagerApprovalsPage />
    </PermissionGate>
  );
}

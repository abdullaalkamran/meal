"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Ban,
  ChefHat,
  ChevronLeft,
  Home,
  ShoppingCart,
  Sun,
  Trash2,
  UserCheck,
  Wrench,
} from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useUsers } from "@/hooks/useUsers";
import { useRooms } from "@/hooks/useRooms";
import { useMealStops } from "@/hooks/useMealStops";
import { useDutyPlans } from "@/hooks/useDutyPlans";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { StarRating } from "@/components/ui/StarRating";
import { MonthNav } from "@/components/ui/MonthNav";
import { RateMemberSheet } from "@/components/manager/RateMemberSheet";
import { MoveMemberSheet } from "@/components/manager/MoveMemberSheet";
import { repo, type Bill, type BillSection, type Payment } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { currentMonth, formatMonthLabel, formatShortDate, lastDayOfMonth } from "@/lib/utils/date";

const SECTION_META: Record<BillSection["label"], { label: string; icon: typeof Sun }> = {
  mealCost: { label: "Meal cost", icon: Sun },
  serviceCharge: { label: "Service charge", icon: Wrench },
  roomRent: { label: "Room rent", icon: Home },
  cookSalary: { label: "Cook salary", icon: ChefHat },
};

export default function MemberProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { activeHostelId } = useSession();
  const members = useUsers(activeHostelId);
  const rooms = useRooms(activeHostelId);
  const mealStops = useMealStops(activeHostelId);
  const dutyPlans = useDutyPlans(activeHostelId);
  const { toast } = useToast();

  const member = members.find((u) => u.id === id);
  const room = rooms.find((r) => r.id === member?.roomId);

  const [bill, setBill] = useState<Bill | undefined>();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [mealStats, setMealStats] = useState({ eaten: 0, off: 0, guests: 0 });
  const [rateOpen, setRateOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [month, setMonth] = useState(currentMonth());

  useEffect(() => {
    if (!activeHostelId || !id) return;
    let cancelled = false;
    repo.bills.getBill(activeHostelId, id, month).then((b) => {
      if (cancelled) return;
      setBill(b);
      if (b) repo.bills.listPayments(b.id).then((p) => !cancelled && setPayments(p));
      else setPayments([]);
    });
    repo.meals.listMealDays(activeHostelId, { from: `${month}-01`, to: lastDayOfMonth(month) }).then((days) => {
      if (cancelled) return;
      let eaten = 0;
      let off = 0;
      let guests = 0;
      for (const day of days) {
        const entry = day.entries[id];
        if (!entry) continue;
        for (const slot of ["breakfast", "lunch", "dinner"] as const) {
          if (entry[slot].on) {
            eaten += 1;
            guests += entry[slot].guestCount;
          } else {
            off += 1;
          }
        }
      }
      setMealStats({ eaten, off, guests });
    });
    return () => {
      cancelled = true;
    };
  }, [activeHostelId, id, month]);

  if (!member) {
    return (
      <div className="flex flex-col gap-4 pt-2">
        <button
          type="button"
          onClick={() => router.push("/manager/members")}
          className="flex items-center gap-1 text-[12px] font-extrabold text-text-secondary"
        >
          <Icon icon={ChevronLeft} size={16} /> Members
        </button>
        <Card className="text-center text-[11.5px] font-semibold text-text-secondary">Member not found.</Card>
      </div>
    );
  }

  const myMealStops = mealStops.filter((r) => r.userId === id);
  const shoppingDays = dutyPlans
    .filter((p) => p.type === "shopping")
    .flatMap((p) => p.blocks.filter((b) => b.userIds.includes(id)).flatMap((b) => b.dates));
  const due = bill ? bill.grandTotal - bill.paid : 0;

  const ban = async () => {
    await repo.users.setBanned(member.id, true);
    toast(`${member.name.split(" ")[0]} banned from this hostel`);
  };
  const unban = async () => {
    await repo.users.setBanned(member.id, false);
    toast(`${member.name.split(" ")[0]} un-banned`);
  };
  const remove = async () => {
    await repo.users.remove(member.id);
    toast(`${member.name.split(" ")[0]} removed`);
    router.push("/manager/members");
  };

  return (
    <div className="flex flex-col gap-5 pt-2">
      <button
        type="button"
        onClick={() => router.push("/manager/members")}
        className="flex items-center gap-1 text-[12px] font-extrabold text-text-secondary"
      >
        <Icon icon={ChevronLeft} size={16} /> Members
      </button>

      {/* Header */}
      <Card className="flex items-center gap-3">
        <Avatar name={member.name} seed={member.avatarSeed} size={54} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-[15px] font-extrabold">{member.name}</div>
            {member.banned ? (
              <span className="rounded-pill bg-danger-soft px-2 py-0.5 text-[9px] font-extrabold text-danger">
                Banned
              </span>
            ) : (
              <span className="rounded-pill bg-primary-soft px-2 py-0.5 text-[9px] font-extrabold text-primary">
                Active
              </span>
            )}
          </div>
          <div className="text-[10.5px] font-semibold text-text-secondary">{member.phone}</div>
          <div className="mt-0.5 text-[10px] font-semibold text-text-secondary">
            {room ? `Room ${room.number}` : "Unassigned"}
            {member.studentId ? ` · ${member.studentId}` : ""}
            {member.joinedAt ? ` · since ${formatShortDate(member.joinedAt)}` : ""}
          </div>
        </div>
      </Card>

      {/* Month filter */}
      <MonthNav value={month} onChange={setMonth} />

      {/* Meal snapshot */}
      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">{formatMonthLabel(month)} &middot; meals</div>
        <div className="grid grid-cols-4 gap-2.5">
          {[
            { label: "Eaten", value: mealStats.eaten, color: "text-primary" },
            { label: "Off", value: mealStats.off, color: "text-text-secondary" },
            { label: "Guests", value: mealStats.guests, color: "text-blue" },
            { label: "Billed", value: bill?.mealsCount ?? 0, color: "text-orange" },
          ].map((s) => (
            <Card key={s.label} className="text-center">
              <div className={`text-[16px] font-extrabold ${s.color}`}>{s.value}</div>
              <div className="mt-0.5 text-[9px] font-bold text-text-secondary">{s.label}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* Bill breakdown */}
      <div>
        <div className="mb-2 flex items-center justify-between text-[13.5px] font-extrabold">
          Bill &middot; {formatMonthLabel(month)}
          <span className={`text-[11px] font-extrabold ${due > 0 ? "text-danger" : "text-primary"}`}>
            {due > 0 ? `Due ${formatBDT(due)}` : bill ? "Paid in full" : "No bill"}
          </span>
        </div>
        {bill ? (
          <Card className="flex flex-col gap-2">
            {bill.dueDate && (
              <div className="flex items-center justify-between text-[10.5px] font-bold text-text-secondary">
                <div>Last day of payment</div>
                <div>{bill.dueDate}</div>
              </div>
            )}
            {bill.sections.map((s) => {
              const meta = SECTION_META[s.label];
              const sectionDue = s.total - s.paid;
              return (
                <div key={s.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon icon={meta.icon} size={14} className="text-text-secondary" />
                    <div className="text-[11.5px] font-bold">{meta.label}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11.5px] font-extrabold">{formatBDT(s.total)}</div>
                    <div
                      className={`text-[9px] font-bold ${
                        sectionDue < 0 ? "text-primary" : sectionDue > 0 ? "text-danger" : "text-text-secondary"
                      }`}
                    >
                      {sectionDue < 0
                        ? `Credit ${formatBDT(-sectionDue)}`
                        : sectionDue > 0
                          ? `Due ${formatBDT(sectionDue)}`
                          : "Paid"}
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        ) : (
          <Card className="text-center text-[11px] font-semibold text-text-secondary">
            No bill generated for this month yet.
          </Card>
        )}
      </div>

      {/* Payment history */}
      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">Payment dates</div>
        <div className="flex flex-col gap-2">
          {payments.length === 0 && (
            <Card className="text-center text-[11px] font-semibold text-text-secondary">
              No payments this month.
            </Card>
          )}
          {payments.map((p) => (
            <Card key={p.id} className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[11.5px] font-extrabold">{formatBDT(p.amount)}</div>
                <div className="text-[9.5px] font-semibold text-text-secondary">
                  {p.method} · {new Date(p.paidAt).toLocaleDateString()}
                  {p.reference ? ` · ${p.reference}` : ""}
                </div>
              </div>
              <span
                className={`rounded-pill px-2.5 py-1 text-[9.5px] font-extrabold ${
                  p.verified ? "bg-primary-soft text-primary" : "bg-orange-soft text-orange"
                }`}
              >
                {p.verified ? "Verified" : "Pending"}
              </span>
            </Card>
          ))}
        </div>
      </div>

      {/* Shopping duty */}
      <div>
        <div className="mb-2 flex items-center justify-between text-[13.5px] font-extrabold">
          Shopping duty
          <span className="text-[10.5px] font-semibold text-text-secondary">{shoppingDays.length} days</span>
        </div>
        <Card>
          {shoppingDays.length === 0 ? (
            <div className="text-[11px] font-semibold text-text-secondary">No shopping days assigned.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {shoppingDays.map((d) => (
                <span
                  key={d}
                  className="flex items-center gap-1 rounded-pill bg-bg px-2.5 py-1 text-[10px] font-bold"
                >
                  <Icon icon={ShoppingCart} size={11} className="text-primary" />
                  {formatShortDate(d)}
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Meal requests */}
      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">Meal requests</div>
        <div className="flex flex-col gap-2">
          {myMealStops.length === 0 && (
            <Card className="text-center text-[11px] font-semibold text-text-secondary">
              No meal-off requests.
            </Card>
          )}
          {myMealStops.map((r) => (
            <Card key={r.id} className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[11.5px] font-extrabold">
                  {formatShortDate(r.dateFrom)}
                  {r.dateTo !== r.dateFrom ? ` – ${formatShortDate(r.dateTo)}` : ""}
                </div>
                <div className="text-[9.5px] font-semibold text-text-secondary">
                  {r.meals.join(", ")}
                  {r.reason ? ` · ${r.reason}` : ""}
                </div>
              </div>
              <span
                className={`rounded-pill px-2.5 py-1 text-[9.5px] font-extrabold ${
                  r.status === "approved"
                    ? "bg-primary-soft text-primary"
                    : r.status === "denied"
                      ? "bg-danger-soft text-danger"
                      : "bg-orange-soft text-orange"
                }`}
              >
                {r.status}
              </span>
            </Card>
          ))}
        </div>
      </div>

      {/* Manager rating */}
      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">Conduct rating</div>
        <Card>
          <div className="flex items-center justify-between">
            <StarRating value={member.managerRating ?? 0} size={20} readOnly />
            <button
              type="button"
              onClick={() => setRateOpen(true)}
              className="rounded-pill bg-primary-soft px-3 py-1.5 text-[10.5px] font-extrabold text-primary"
            >
              {typeof member.managerRating === "number" ? "Edit" : "Rate"}
            </button>
          </div>
          {member.managerRatingNote && (
            <div className="mt-2 text-[10.5px] font-semibold text-text-secondary">
              &ldquo;{member.managerRatingNote}&rdquo;
            </div>
          )}
        </Card>
      </div>

      {/* Actions */}
      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">Manage</div>
        <div className="flex flex-col gap-2">
          {!member.banned && member.role !== "manager" && (
            <button
              type="button"
              onClick={() => setMoveOpen(true)}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-btn bg-bg text-[12px] font-extrabold"
            >
              <Icon icon={ArrowLeftRight} size={15} /> Move room
            </button>
          )}
          {member.role !== "manager" &&
            (member.banned ? (
              <button
                type="button"
                onClick={unban}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-btn bg-primary-soft text-[12px] font-extrabold text-primary"
              >
                <Icon icon={UserCheck} size={15} /> Un-ban member
              </button>
            ) : (
              <button
                type="button"
                onClick={ban}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-btn bg-orange-soft text-[12px] font-extrabold text-orange"
              >
                <Icon icon={Ban} size={15} /> Ban from this hostel
              </button>
            ))}
          {member.role !== "manager" &&
            (confirmRemove ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={remove}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-btn bg-danger text-[12px] font-extrabold text-white"
                >
                  <Icon icon={Trash2} size={15} /> Confirm remove
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  className="min-h-11 flex-1 rounded-btn border border-border text-[12px] font-extrabold"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-btn bg-danger-soft text-[12px] font-extrabold text-danger"
              >
                <Icon icon={Trash2} size={15} /> Remove from hostel
              </button>
            ))}
          {member.role === "manager" && (
            <Card className="text-center text-[10.5px] font-semibold text-text-secondary">
              This is the hostel manager&rsquo;s own boarder account — it can&rsquo;t be moved, banned, or removed here.
            </Card>
          )}
        </div>
      </div>

      <RateMemberSheet open={rateOpen} onClose={() => setRateOpen(false)} member={member} />
      <MoveMemberSheet open={moveOpen} onClose={() => setMoveOpen(false)} member={member} />
    </div>
  );
}

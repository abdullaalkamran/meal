"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { AlertTriangle, Bell, BookOpen, CalendarClock, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, ShoppingBag } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useUsers } from "@/hooks/useUsers";
import { useDutyPlans } from "@/hooks/useDutyPlans";
import { useSwaps } from "@/hooks/useSwaps";
import { useShortages } from "@/hooks/useShortages";
import { useProducts } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { useMemberArea } from "@/hooks/useMemberArea";
import { isAvailableAt } from "@/lib/geo/bangladesh";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { SpinWheel } from "@/components/ui/SpinWheel";
import { ProductCard } from "@/components/store/ProductCard";
import { MenuEditSheet } from "@/components/hostel/MenuEditSheet";
import { ActivityTimeline } from "@/components/hostel/ActivityTimeline";
import { repo, type ShoppingCost } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { addDays, formatMonthLabel, formatShortDate, today } from "@/lib/utils/date";
import { downloadDutyReminder } from "@/lib/utils/dutyReminder";

export default function StudentShoppingPage() {
  const { user, hostel, activeHostelId } = useSession();
  const users = useUsers(activeHostelId);
  const plans = useDutyPlans(activeHostelId);
  const swaps = useSwaps(activeHostelId);
  const shortages = useShortages(activeHostelId);
  const { toast } = useToast();
  const [cost, setCost] = useState("");
  const [items, setItems] = useState("");
  const [allCosts, setAllCosts] = useState<ShoppingCost[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rotationOpen, setRotationOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const swapSectionRef = useRef<HTMLDivElement>(null);
  // Which month's shopping records to browse — defaults to the current month,
  // steppable back to see previous months.
  const [recordYear, setRecordYear] = useState(() => new Date().getFullYear());
  const [recordMonth, setRecordMonth] = useState(() => new Date().getMonth() + 1);
  const recordMonthStr = `${recordYear}-${String(recordMonth).padStart(2, "0")}`;
  const stepRecordMonth = (delta: number) => {
    let m = recordMonth + delta;
    let y = recordYear;
    if (m < 1) { m = 12; y -= 1; }
    else if (m > 12) { m = 1; y += 1; }
    setRecordMonth(m);
    setRecordYear(y);
  };

  const plan = plans.find(
    (p) => p.type === "shopping" && p.memberIds.includes(user?.id ?? "") && p.endDate >= today()
  );
  // A rotation can be running for the rest of the hostel without this member
  // in it — most commonly because they joined after the manager created it.
  // New plans only ever enroll whoever the manager had selected at creation
  // time, so distinguishing this from "no rotation at all" avoids reading as
  // a bug ("everyone else already spun and I can't").
  const otherActivePlan = plans.find(
    (p) => p.type === "shopping" && !p.memberIds.includes(user?.id ?? "") && p.endDate >= today()
  );
  const myBlockIndex = plan?.blocks.findIndex((b) => b.userIds.includes(user?.id ?? "")) ?? -1;
  const myBlock = plan && myBlockIndex >= 0 ? plan.blocks[myBlockIndex] : undefined;
  const hasSpun = user ? plan?.spun[user.id] : false;
  const partnerNames = myBlock
    ? myBlock.userIds.filter((id) => id !== user?.id).map((id) => users.find((u) => u.id === id)?.name ?? id)
    : [];

  useEffect(() => {
    if (!activeHostelId) return;
    repo.shoppingCosts.listByHostel(activeHostelId).then((list) =>
      setAllCosts([...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    );
  }, [activeHostelId, cost]);

  // Records for the selected month (any date of the cost falls in that month).
  const monthRecords = allCosts.filter((c) => c.dates.some((d) => d.startsWith(recordMonthStr)));
  // Who was on shopping duty in the selected month — blocks from ANY rotation
  // (current or a past one still on record) whose dates fall in that month.
  const monthBlocks = plans
    .filter((p) => p.type === "shopping")
    .flatMap((p) =>
      p.blocks
        .filter((b) => b.userIds.length > 0 && b.dates.some((d) => d.startsWith(recordMonthStr)))
        .map((b) => ({ userIds: b.userIds, dates: b.dates, done: b.userIds.some((id) => p.done?.[id]) }))
    )
    .sort((a, b) => a.dates[0].localeCompare(b.dates[0]));

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const blockOf = (id: string) => plan?.blocks.find((b) => b.userIds.includes(id));
  const groupNameOf = (id: string) => {
    const block = blockOf(id);
    return block ? block.userIds.map(nameOf).join(" + ") : nameOf(id);
  };

  // Swaps are between duty blocks (a companion pair or a solo individual), not
  // specific people — any member of the requesting/target block sees the same
  // pending state, since fromUserId/toUserId are just a representative id of
  // that block.
  const planSwaps = swaps.filter((s) => s.planId === plan?.id);
  const myOutgoing = planSwaps.find(
    (s) => s.status === "pending" && myBlock?.userIds.includes(s.fromUserId)
  );
  const myIncoming = planSwaps.find(
    (s) => s.status === "pending" && myBlock?.userIds.includes(s.toUserId)
  );

  const requestSwap = async (toUserId: string) => {
    if (!activeHostelId || !plan || !user) return;
    await repo.swaps.request({ hostelId: activeHostelId, planId: plan.id, fromUserId: user.id, toUserId });
    toast("Swap request sent");
  };

  const resolveSwap = async (swapId: string, status: "accepted" | "denied" | "cancelled") => {
    await repo.swaps.resolve(swapId, status);
    toast(status === "accepted" ? "Swap completed" : status === "denied" ? "Swap denied" : "Swap cancelled");
  };

  // Duty status for the signed-in member's block.
  const tomorrow = addDays(today(), 1);
  const isDutyTomorrow = !!myBlock && myBlock.dates.includes(tomorrow);
  const myDone = !!(user && plan?.done?.[user.id]);
  const dutyStarted = !!myBlock && today() >= myBlock.dates[0];
  const canMarkDone = !!myBlock && !!hasSpun && dutyStarted && !myDone;
  // A duty block is swappable only if it hasn't STARTED yet (so not a duty
  // that's currently running or already passed) and no one in it has marked it
  // done — you can't hand a duty to someone who's already on it or finished.
  const isSwappable = (b: { userIds: string[]; dates: string[] }) =>
    b.dates[0] > today() && !b.userIds.some((id) => plan?.done?.[id]);

  const markMyDutyDone = async () => {
    if (!plan || !user) return;
    await repo.duties.markDone(plan.id, user.id);
    toast("Marked your shopping duty as done — everyone can see it now");
  };

  const pendingShortages = shortages.filter((s) => s.status === "pending");

  const resolveShortage = async (id: string) => {
    if (!user) return;
    await repo.shortages.resolve(id, user.id);
    toast("Shortage marked as bought");
  };

  const submitCost = async () => {
    if (!activeHostelId || !user || !myBlock || !cost) return;
    await repo.shoppingCosts.submit({
      hostelId: activeHostelId,
      userId: user.id,
      dates: myBlock.dates,
      amount: Number(cost),
      items,
    });
    toast("Shopping cost recorded");
    setCost("");
    setItems("");
  };

  const memberArea = useMemberArea();
  const groceryPicks = useProducts("grocery")
    .filter((p) => p.active && isAvailableAt(p.areas, memberArea))
    .slice(0, 2);
  const cartItems = useCart(user?.id);
  const qtyOf = (id: string) => cartItems.find((c) => c.productId === id)?.qty ?? 0;

  // Recommendation strip: two products from the platform grocery store, plus a
  // books teaser — shown to every member regardless of duty state.
  const storeStrip = (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="text-[13.5px] font-extrabold">From the grocery store</div>
        <Link href="/explore/grocery" className="flex items-center gap-0.5 text-[11px] font-extrabold text-primary">
          Shop all
          <Icon icon={ChevronRight} size={14} />
        </Link>
      </div>
      {groceryPicks.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          {groceryPicks.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              qty={qtyOf(p.id)}
              onAdd={() => user && repo.cart.add(user.id, p.id)}
              onSetQty={(qty) => user && repo.cart.setQty(user.id, p.id, qty)}
            />
          ))}
        </div>
      )}
      <Link href="/explore/books">
        <Card className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-soft text-orange">
            <Icon icon={BookOpen} size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-extrabold">Buy books</div>
            <div className="text-[10px] font-semibold text-text-secondary">
              New books from the platform · old books from members
            </div>
          </div>
          <Icon icon={ChevronRight} size={16} className="text-text-secondary" />
        </Card>
      </Link>
    </div>
  );

  const shortageAlerts = pendingShortages.length > 0 && (
    <div className="flex flex-col gap-2">
      {pendingShortages.map((s) => (
        <div key={s.id} className="rounded-card border border-danger/30 bg-danger-soft p-4">
          <div className="mb-1 flex items-center gap-2">
            <Icon icon={AlertTriangle} size={16} className="text-danger" />
            <div className="text-[12.5px] font-extrabold text-danger">Shortage reported by cook</div>
          </div>
          <div className={clsx("text-[11.5px] font-semibold text-text", myBlock && "mb-3")}>
            {s.items}
          </div>
          {myBlock && (
            <button
              type="button"
              onClick={() => resolveShortage(s.id)}
              className="min-h-10 w-full cursor-pointer rounded-btn bg-danger text-[12px] font-extrabold text-white"
            >
              Mark shortage bought
            </button>
          )}
        </div>
      ))}
    </div>
  );

  if (!plan) {
    return (
      <div className="flex flex-col gap-5 pt-2">
        <div className="text-[17.5px] font-extrabold tracking-tight">Shopping</div>
        {shortageAlerts}
        {storeStrip}
        <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
          {otherActivePlan
            ? "A shopping duty rotation is already running for the rest of the hostel — you'll join the next one, once this one wraps up."
            : "No active shopping duty rotation right now."}
        </Card>
        <ActivityTimeline hostelId={activeHostelId} category="shopping" title="Shopping activity" />
      </div>
    );
  }

  // Blocks this member could hand their duty to — others' blocks that haven't
  // passed and aren't already marked done.
  const swapTargets = plan.blocks.filter(
    (b) => b.userIds.length > 0 && !b.userIds.includes(user?.id ?? "") && isSwappable(b)
  );
  // Members who haven't spun to claim a slot yet.
  const notSpun = plan.memberIds.filter((id) => !plan.spun?.[id]);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="text-[17.5px] font-extrabold tracking-tight">Shopping</div>

      {isDutyTomorrow && myBlock && (
        <div className="rounded-card border border-orange/30 bg-orange-soft p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange text-white">
              <Icon icon={Bell} size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-extrabold text-orange">Tomorrow is your shopping duty</div>
              <div className="text-[10.5px] font-semibold text-text">
                {formatShortDate(myBlock.dates[0])}
                {myBlock.dates.length > 1 ? ` – ${formatShortDate(myBlock.dates.at(-1)!)}` : ""} · get ready to shop.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => downloadDutyReminder(myBlock.dates, hostel?.name)}
            className="mt-3 flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-btn bg-orange text-[12px] font-extrabold text-white"
          >
            <Icon icon={CalendarClock} size={15} />
            Set a phone reminder
          </button>
        </div>
      )}

      {shortageAlerts}

      {storeStrip}

      {!hasSpun ? (
        <div
          className="flex flex-col items-center rounded-card py-6 shadow-soft"
          style={{ background: "#181c2e" }}
        >
          <div className="mb-4 text-[11.5px] font-bold text-white/70">Spin to claim your dates</div>
          <SpinWheel
            segments={plan.blocks.map((b, i) => ({
              id: String(i),
              label:
                b.dates.length > 1
                  ? `${formatShortDate(b.dates[0])}–${formatShortDate(b.dates.at(-1)!)}`
                  : formatShortDate(b.dates[0]),
            }))}
            onSpin={async () => {
              if (!user) return -1;
              const index = await repo.duties.spin(plan.id, user.id);
              if (index < 0) toast("This rotation is already full — ask your manager.");
              return index;
            }}
          />
        </div>
      ) : (
        myBlock && (
          <div
            className="rounded-card p-5 text-white"
            style={{ background: "linear-gradient(135deg, var(--color-orange), #92400E)" }}
          >
            <div className="text-[11px] font-bold text-white/80">Your shopping duty</div>
            <div className="mt-1 mb-3 text-[16.5px] font-extrabold">
              {formatShortDate(myBlock.dates[0])}
              {myBlock.dates.length > 1 ? ` – ${formatShortDate(myBlock.dates.at(-1)!)}` : ""}
            </div>
            <div className="flex gap-2">
              {plan.budgetPerDay && (
                <div className="min-w-0 flex-1 rounded-btn bg-white/15 px-3 py-2">
                  <div className="text-[9.5px] font-bold text-white/70">Budget</div>
                  <div className="text-[12px] font-extrabold">{formatBDT(plan.budgetPerDay)}/day</div>
                </div>
              )}
              {partnerNames.length > 0 && (
                <div className="min-w-0 flex-1 rounded-btn bg-white/15 px-3 py-2">
                  <div className="text-[9.5px] font-bold text-white/70">Partner</div>
                  <div className="truncate text-[12px] font-extrabold">{partnerNames.join(", ")}</div>
                </div>
              )}
            </div>
            {myBlock.dates.at(-1)! >= today() && (
              <button
                type="button"
                onClick={() => downloadDutyReminder(myBlock.dates, hostel?.name)}
                className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-btn bg-white/15 text-[12px] font-extrabold text-white"
              >
                <Icon icon={CalendarClock} size={15} /> Set a phone reminder
              </button>
            )}
            {myBlock.dates.includes(today()) && (
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="mt-2 min-h-11 w-full cursor-pointer rounded-btn bg-white/90 text-[12px] font-extrabold text-[#92400E]"
              >
                Edit today&rsquo;s menu
              </button>
            )}
            {!myOutgoing && !myIncoming && isSwappable(myBlock) && (
              <button
                type="button"
                onClick={() => {
                  setSwapOpen(true);
                  setTimeout(
                    () => swapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
                    50
                  );
                }}
                className="mt-2 min-h-11 w-full cursor-pointer rounded-btn border border-white/40 text-[12px] font-extrabold text-white"
              >
                Request duty swap
              </button>
            )}
            {myDone ? (
              <div className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-btn bg-white/20 text-[12px] font-extrabold text-white">
                <Icon icon={Check} size={15} /> Duty completed
              </div>
            ) : (
              canMarkDone && (
                <button
                  type="button"
                  onClick={markMyDutyDone}
                  className="mt-2 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-btn bg-white/90 text-[12px] font-extrabold text-[#92400E]"
                >
                  <Icon icon={Check} size={15} /> Mark my duty as done
                </button>
              )
            )}
          </div>
        )
      )}

      <div ref={swapSectionRef} className="flex flex-col gap-5">
        {myIncoming && (
          <Card>
            <div className="mb-2 text-[12px] font-bold">
              {groupNameOf(myIncoming.fromUserId)} wants to swap duty dates with you
            </div>
            <div className="flex gap-2">
              <Button fullWidth onClick={() => resolveSwap(myIncoming.id, "accepted")}>
                Accept
              </Button>
              <Button fullWidth variant="secondary" onClick={() => resolveSwap(myIncoming.id, "denied")}>
                Deny
              </Button>
            </div>
          </Card>
        )}

        {myOutgoing && (
          <Card className="flex items-center justify-between">
            <div className="text-[11.5px] font-semibold text-text-secondary">
              Swap request pending with {groupNameOf(myOutgoing.toUserId)}
            </div>
            <button
              type="button"
              onClick={() => resolveSwap(myOutgoing.id, "cancelled")}
              className="text-[11px] font-extrabold text-danger"
            >
              Cancel
            </button>
          </Card>
        )}

        {hasSpun && !myOutgoing && !myIncoming && !myDone && dutyStarted === false && swapTargets.length > 0 && (
          <Card>
            <button
              type="button"
              onClick={() => setSwapOpen((o) => !o)}
              className="flex w-full cursor-pointer items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <div className="text-[13.5px] font-extrabold">Request a swap</div>
                <span className="rounded-pill bg-bg px-2 py-0.5 text-[9px] font-extrabold text-text-secondary">
                  {swapTargets.length} available
                </span>
              </div>
              <Icon
                icon={ChevronDown}
                size={16}
                className={clsx("shrink-0 text-text-secondary transition-transform", swapOpen && "rotate-180")}
              />
            </button>
            {swapOpen && (
              <div className="mt-3 flex flex-col gap-2">
                {swapTargets.map((b) => (
                  <div
                    key={b.userIds.join("-")}
                    className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-bold">
                        {b.userIds.map(nameOf).join(" + ")}
                      </div>
                      <div className="text-[10.5px] font-semibold text-text-secondary">
                        {b.dates[0]} → {b.dates.at(-1)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => requestSwap(b.userIds[0])}
                      className="shrink-0 text-[11px] font-extrabold text-primary"
                    >
                      Request swap
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {hasSpun && myBlock && today() >= myBlock.dates[0] && (
        <Card>
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Icon icon={ClipboardList} size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-extrabold">Submit my shopping cost</div>
              <div className="truncate text-[10.5px] font-semibold text-text-secondary">
                For your duty on {formatShortDate(myBlock.dates[0])}
                {plan.budgetPerDay ? ` · Budget ${formatBDT(plan.budgetPerDay)}` : ""}
              </div>
            </div>
          </div>
          <div className="mb-1.5 text-[10.5px] font-bold text-text-secondary">Amount spent</div>
          <div className="relative mb-3">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-extrabold text-primary">
              ৳
            </span>
            <input
              type="number"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-btn border border-border bg-transparent py-2.5 pl-7 pr-3 text-[12px] font-bold"
            />
          </div>
          <div className="mb-1.5 text-[10.5px] font-bold text-text-secondary">
            Number of items (optional)
          </div>
          <input
            type="text"
            value={items}
            onChange={(e) => setItems(e.target.value)}
            placeholder="e.g. 12"
            className="mb-4 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
          <button
            type="button"
            onClick={submitCost}
            disabled={!cost}
            className="min-h-11 w-full cursor-pointer rounded-btn font-extrabold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))" }}
          >
            Submit cost
          </button>
        </Card>
      )}

      <div>
        <button
          type="button"
          onClick={() => setRotationOpen((o) => !o)}
          className="mb-2 flex w-full cursor-pointer items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
              Rotation · {formatMonthLabel(plan.startDate.slice(0, 7))}
            </div>
            {notSpun.length > 0 ? (
              <span className="rounded-pill bg-orange-soft px-2 py-0.5 text-[9px] font-extrabold text-orange">
                {notSpun.length} not claimed yet
              </span>
            ) : (
              <span className="rounded-pill bg-primary-soft px-2 py-0.5 text-[9px] font-extrabold text-primary">
                All claimed
              </span>
            )}
          </div>
          <Icon
            icon={ChevronDown}
            size={16}
            className={clsx("shrink-0 text-text-secondary transition-transform", rotationOpen && "rotate-180")}
          />
        </button>
        {rotationOpen && (
        <div className="flex flex-col gap-2">
          {plan.blocks.map((b, i) => {
            const claimed = b.userIds.length > 0;
            const isMe = b.userIds.includes(user?.id ?? "");
            const isToday = b.dates.includes(today());
            const isDone = b.dates.at(-1)! < today();
            // Someone in this block actively marked it finished.
            const markedDone = b.userIds.some((id) => plan.done?.[id]);
            const status = markedDone
              ? "✓ Done"
              : !claimed
                ? "Open"
                : isMe
                  ? "You"
                  : isToday
                    ? "Today"
                    : isDone
                      ? "Done"
                      : "Taken";
            return (
              <div
                key={i}
                className={clsx(
                  "flex items-center justify-between rounded-btn px-3 py-2.5 shadow-chip",
                  isMe ? "bg-primary-soft" : "bg-card"
                )}
              >
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-bold">
                    {claimed ? b.userIds.map(nameOf).join(" + ") : "Not claimed yet"}
                  </div>
                  <div className="text-[10.5px] font-semibold text-text-secondary">
                    {formatShortDate(b.dates[0])}
                    {b.dates.length > 1 ? ` – ${formatShortDate(b.dates.at(-1)!)}` : ""}
                  </div>
                </div>
                <div
                  className={clsx(
                    "shrink-0 rounded-pill px-2.5 py-1 text-[9.5px] font-extrabold",
                    status === "✓ Done"
                      ? "bg-primary text-white"
                      : status === "You"
                        ? "bg-primary text-white"
                        : status === "Today"
                          ? "bg-orange-soft text-orange"
                          : status === "Open"
                            ? "bg-primary-soft text-primary"
                            : "bg-bg text-text-secondary"
                  )}
                >
                  {status}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Shopping records + responsible persons — browse any month */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
            Shopping · {formatMonthLabel(recordMonthStr)}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => stepRecordMonth(-1)}
              aria-label="Previous month"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border"
            >
              <Icon icon={ChevronLeft} size={13} />
            </button>
            <div className="min-w-[92px] text-center text-[11px] font-extrabold">
              {formatMonthLabel(recordMonthStr)}
            </div>
            <button
              type="button"
              onClick={() => stepRecordMonth(1)}
              aria-label="Next month"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-border"
            >
              <Icon icon={ChevronRight} size={13} />
            </button>
          </div>
        </div>

        {/* Responsible persons that month */}
        <div className="mb-1.5 text-[9.5px] font-bold uppercase tracking-wide text-text-secondary">
          Responsible
        </div>
        {monthBlocks.length === 0 ? (
          <Card className="mb-3 text-center text-[11px] font-semibold text-text-secondary">
            No shopping duty scheduled in {formatMonthLabel(recordMonthStr)}.
          </Card>
        ) : (
          <div className="mb-3 flex flex-col gap-2">
            {monthBlocks.map((b, i) => {
              const isMe = b.userIds.includes(user?.id ?? "");
              const isToday = b.dates.includes(today());
              const isPast = b.dates.at(-1)! < today();
              const label = b.done ? "✓ Done" : isToday ? "Today" : isPast ? "Done" : "Upcoming";
              return (
                <div
                  key={i}
                  className={clsx(
                    "flex items-center justify-between rounded-btn px-3 py-2.5 shadow-chip",
                    isMe ? "bg-primary-soft" : "bg-card"
                  )}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-bold">{b.userIds.map(nameOf).join(" + ")}</div>
                    <div className="text-[10.5px] font-semibold text-text-secondary">
                      {formatShortDate(b.dates[0])}
                      {b.dates.length > 1 ? ` – ${formatShortDate(b.dates.at(-1)!)}` : ""}
                    </div>
                  </div>
                  <div
                    className={clsx(
                      "shrink-0 rounded-pill px-2.5 py-1 text-[9.5px] font-extrabold",
                      b.done || isToday ? "bg-primary text-white" : "bg-bg text-text-secondary"
                    )}
                  >
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recorded shopping costs that month */}
        <div className="mb-1.5 text-[9.5px] font-bold uppercase tracking-wide text-text-secondary">
          Recorded costs
        </div>
        {monthRecords.length === 0 ? (
          <Card className="text-center text-[11px] font-semibold text-text-secondary">
            No shopping recorded in {formatMonthLabel(recordMonthStr)}.
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {monthRecords.map((h) => (
              <Card key={h.id} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-soft text-blue">
                  <Icon icon={ShoppingBag} size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="text-[11.5px] font-extrabold">{nameOf(h.userId)}</div>
                    {h.addedByManager && (
                      <span className="rounded-pill bg-orange-soft px-1.5 py-0.5 text-[8px] font-extrabold text-orange">
                        Added by manager
                      </span>
                    )}
                    {h.status === "pending" && (
                      <span className="rounded-pill bg-bg px-1.5 py-0.5 text-[8px] font-extrabold text-text-secondary">
                        Pending
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-semibold text-text-secondary">
                    {formatShortDate(h.dates[0])}
                    {h.items ? ` · ${h.items} items` : ""}
                  </div>
                </div>
                <div className="text-[12px] font-extrabold">{formatBDT(h.amount)}</div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Who submitted/approved/recorded shopping costs, and when */}
      <ActivityTimeline hostelId={activeHostelId} category="shopping" title="Shopping activity" />

      <MenuEditSheet open={menuOpen} onClose={() => setMenuOpen(false)} hostelId={activeHostelId} />
    </div>
  );
}

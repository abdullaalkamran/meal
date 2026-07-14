"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { AlertTriangle, BookOpen, ChevronRight, ClipboardList, ShoppingBag } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useUsers } from "@/hooks/useUsers";
import { useDutyPlans } from "@/hooks/useDutyPlans";
import { useSwaps } from "@/hooks/useSwaps";
import { useShortages } from "@/hooks/useShortages";
import { useProducts } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { SpinWheel } from "@/components/ui/SpinWheel";
import { ProductCard } from "@/components/store/ProductCard";
import { repo, type ShoppingCost } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { formatMonthLabel, formatShortDate, today } from "@/lib/utils/date";

export default function StudentShoppingPage() {
  const { user, activeHostelId } = useSession();
  const users = useUsers(activeHostelId);
  const plans = useDutyPlans(activeHostelId);
  const swaps = useSwaps(activeHostelId);
  const shortages = useShortages(activeHostelId);
  const { toast } = useToast();
  const [cost, setCost] = useState("");
  const [items, setItems] = useState("");
  const [history, setHistory] = useState<ShoppingCost[]>([]);
  const swapSectionRef = useRef<HTMLDivElement>(null);

  const plan = plans.find(
    (p) => p.type === "shopping" && p.memberIds.includes(user?.id ?? "") && p.endDate >= today()
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
      setHistory([...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5))
    );
  }, [activeHostelId, cost]);

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

  const groceryPicks = useProducts("grocery").filter((p) => p.active).slice(0, 2);
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
          No active shopping duty rotation right now.
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="text-[17.5px] font-extrabold tracking-tight">Shopping</div>

      {shortageAlerts}

      {storeStrip}

      {!hasSpun ? (
        <div
          className="flex flex-col items-center rounded-card py-6 shadow-soft"
          style={{ background: "#181c2e" }}
        >
          <div className="mb-4 text-[11.5px] font-bold text-white/70">Spin to reveal your dates</div>
          <SpinWheel
            segments={plan.blocks.map((b) => ({
              id: b.userIds.join("-"),
              label: b.userIds.map((id) => nameOf(id).split(" ")[0]).join("+"),
            }))}
            targetIndex={myBlockIndex}
            onSpinEnd={() => user && repo.duties.spin(plan.id, user.id)}
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
            {!myOutgoing && !myIncoming && (
              <button
                type="button"
                onClick={() =>
                  swapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
                className="mt-3 min-h-11 w-full cursor-pointer rounded-btn bg-white/90 text-[12px] font-extrabold text-[#92400E]"
              >
                Request duty swap
              </button>
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

        {hasSpun && !myOutgoing && !myIncoming && (
          <Card>
            <div className="mb-3 text-[13.5px] font-extrabold">Request a swap</div>
            <div className="flex flex-col gap-2">
              {plan.blocks
                .filter((b) => !b.userIds.includes(user?.id ?? ""))
                .map((b) => (
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
        <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
          Rotation · {formatMonthLabel(plan.startDate.slice(0, 7))}
        </div>
        <div className="flex flex-col gap-2">
          {plan.blocks.map((b) => {
            const isMe = b.userIds.includes(user?.id ?? "");
            const isToday = b.dates.includes(today());
            const isDone = b.dates.at(-1)! < today();
            const status = isMe ? "You" : isToday ? "Today" : isDone ? "Done" : "Next";
            return (
              <div
                key={b.userIds.join("-")}
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
                    status === "You"
                      ? "bg-primary text-white"
                      : status === "Today"
                        ? "bg-orange-soft text-orange"
                        : "bg-bg text-text-secondary"
                  )}
                >
                  {status}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {history.length > 0 && (
        <div>
          <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
            Recent shopping
          </div>
          <div className="flex flex-col gap-2">
            {history.map((h) => (
              <Card key={h.id} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-soft text-blue">
                  <Icon icon={ShoppingBag} size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] font-extrabold">{nameOf(h.userId)}</div>
                  <div className="text-[10px] font-semibold text-text-secondary">
                    {formatShortDate(h.dates[0])}
                    {h.items ? ` · ${h.items} items` : ""}
                  </div>
                </div>
                <div className="text-[12px] font-extrabold">{formatBDT(h.amount)}</div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

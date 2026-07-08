"use client";

import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useUsers } from "@/hooks/useUsers";
import { useDutyPlans } from "@/hooks/useDutyPlans";
import { useSwaps } from "@/hooks/useSwaps";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { SpinWheel } from "@/components/ui/SpinWheel";
import { repo, type ShoppingCost } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";
import { formatShortDate, today } from "@/lib/utils/date";

export default function StudentShoppingPage() {
  const { user, activeHostelId } = useSession();
  const users = useUsers(activeHostelId);
  const plans = useDutyPlans(activeHostelId);
  const swaps = useSwaps(activeHostelId);
  const { toast } = useToast();
  const [cost, setCost] = useState("");
  const [items, setItems] = useState("");
  const [history, setHistory] = useState<ShoppingCost[]>([]);

  const plan = plans.find(
    (p) => p.type === "shopping" && p.memberIds.includes(user?.id ?? "") && p.endDate >= today()
  );
  const myBlockIndex = plan?.blocks.findIndex((b) => b.userId === user?.id) ?? -1;
  const myBlock = plan && myBlockIndex >= 0 ? plan.blocks[myBlockIndex] : undefined;
  const hasSpun = user ? plan?.spun[user.id] : false;

  useEffect(() => {
    if (!activeHostelId) return;
    repo.shoppingCosts.listByHostel(activeHostelId).then((list) =>
      setHistory([...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5))
    );
  }, [activeHostelId, cost]);

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? id;

  const planSwaps = swaps.filter((s) => s.planId === plan?.id);
  const myOutgoing = planSwaps.find((s) => s.fromUserId === user?.id && s.status === "pending");
  const myIncoming = planSwaps.find((s) => s.toUserId === user?.id && s.status === "pending");

  const requestSwap = async (toUserId: string) => {
    if (!activeHostelId || !plan || !user) return;
    await repo.swaps.request({ hostelId: activeHostelId, planId: plan.id, fromUserId: user.id, toUserId });
    toast("Swap request sent");
  };

  const resolveSwap = async (swapId: string, status: "accepted" | "denied" | "cancelled") => {
    await repo.swaps.resolve(swapId, status);
    toast(status === "accepted" ? "Swap completed" : status === "denied" ? "Swap denied" : "Swap cancelled");
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

  if (!plan) {
    return (
      <div className="flex flex-col gap-5 pt-2">
        <div className="text-[17.5px] font-extrabold tracking-tight">Shopping</div>
        <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
          No active shopping duty rotation right now.
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="text-[17.5px] font-extrabold tracking-tight">Shopping</div>

      {!hasSpun ? (
        <div
          className="flex flex-col items-center rounded-card py-6 shadow-soft"
          style={{ background: "#181c2e" }}
        >
          <div className="mb-4 text-[11.5px] font-bold text-white/70">Spin to reveal your dates</div>
          <SpinWheel
            segments={plan.blocks.map((b) => ({ id: b.userId, label: nameOf(b.userId).split(" ")[0] }))}
            targetIndex={myBlockIndex}
            onSpinEnd={() => user && repo.duties.spin(plan.id, user.id)}
          />
        </div>
      ) : (
        myBlock && (
          <div
            className="rounded-card p-5 text-white"
            style={{ background: "linear-gradient(135deg, var(--color-primary), #0a8f86)" }}
          >
            <div className="text-[11px] font-bold text-white/80">Your shopping duty</div>
            <div className="mt-1 mb-3 text-[16.5px] font-extrabold">
              {formatShortDate(myBlock.dates[0])}
              {myBlock.dates.length > 1 ? ` – ${formatShortDate(myBlock.dates.at(-1)!)}` : ""}
            </div>
            {plan.budgetPerDay && (
              <div className="inline-flex items-center gap-2 rounded-btn bg-white/15 px-3 py-2">
                <div className="text-[9.5px] font-bold text-white/70">Budget</div>
                <div className="text-[12px] font-extrabold">{formatBDT(plan.budgetPerDay)}/day</div>
              </div>
            )}
          </div>
        )
      )}

      {myIncoming && (
        <Card>
          <div className="mb-2 text-[12px] font-bold">
            {nameOf(myIncoming.fromUserId)} wants to swap duty dates with you
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
            Swap request pending with {nameOf(myOutgoing.toUserId)}
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
              .filter((b) => b.userId !== user?.id)
              .map((b) => (
                <div
                  key={b.userId}
                  className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5"
                >
                  <div>
                    <div className="text-[12px] font-bold">{nameOf(b.userId)}</div>
                    <div className="text-[10.5px] font-semibold text-text-secondary">
                      {b.dates[0]} → {b.dates.at(-1)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => requestSwap(b.userId)}
                    className="text-[11px] font-extrabold text-primary"
                  >
                    Request swap
                  </button>
                </div>
              ))}
          </div>
        </Card>
      )}

      {hasSpun && myBlock && today() >= myBlock.dates[0] && (
        <Card>
          <div className="mb-0.5 text-[13.5px] font-extrabold">Submit my shopping cost</div>
          <div className="mb-3 text-[10.5px] font-semibold text-text-secondary">
            For your duty on {formatShortDate(myBlock.dates[0])}
            {plan.budgetPerDay ? ` · Budget ${formatBDT(plan.budgetPerDay)}` : ""}
          </div>
          <div className="mb-1.5 text-[10px] font-bold text-text-secondary">AMOUNT SPENT</div>
          <input
            type="number"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="৳ 0.00"
            className="mb-3 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
          />
          <div className="mb-1.5 text-[10px] font-bold text-text-secondary">
            NUMBER OF ITEMS (OPTIONAL)
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
          Rotation
        </div>
        <div className="flex flex-col gap-2">
          {plan.blocks.map((b) => (
            <div key={b.userId} className="flex items-center justify-between rounded-btn bg-card px-3 py-2.5 shadow-chip">
              <div className="text-[12px] font-bold">{nameOf(b.userId)}</div>
              <div className="flex items-center gap-2">
                <div className="text-[10.5px] font-semibold text-text-secondary">
                  {formatShortDate(b.dates[0])} – {formatShortDate(b.dates.at(-1)!)}
                </div>
                <Chip tone={plan.spun[b.userId] ? "primary" : "neutral"} active={plan.spun[b.userId]}>
                  {plan.spun[b.userId] ? "Spun" : "Pending"}
                </Chip>
              </div>
            </div>
          ))}
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

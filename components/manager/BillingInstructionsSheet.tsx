"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Icon } from "@/components/ui/Icon";

interface Section {
  id: string;
  title: string;
  body: React.ReactNode;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10px] font-extrabold text-primary">
        {n}
      </div>
      <div className="min-w-0 flex-1 text-[11px] font-semibold text-text-secondary">{children}</div>
    </div>
  );
}

const SECTIONS: Section[] = [
  {
    id: "overview",
    title: "How it all fits together",
    body: (
      <div className="flex flex-col gap-2 text-[11px] font-semibold text-text-secondary">
        <p>
          Nobody sets a meal price by hand. Every month, the app works out the real cost automatically:
        </p>
        <p className="rounded-btn bg-bg px-3 py-2 text-center font-extrabold text-text">
          Approved shopping spend ÷ meals actually cooked = this month&rsquo;s cost per meal
        </p>
        <p>
          That per-meal rate, plus room rent, plus any service charges or cook salary you&rsquo;ve recorded,
          is what &ldquo;Generate bills&rdquo; turns into each member&rsquo;s bill. So the order that matters
          during the month is:
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <Step n={1}>Someone shops for groceries → you (or they) record the cost.</Step>
          <Step n={2}>Each day, you confirm which meals were actually cooked.</Step>
          <Step n={3}>You record any other expenses (utilities, cook salary, etc.).</Step>
          <Step n={4}>At month-end (or anytime), you generate bills.</Step>
        </div>
        <p>
          Skip step 2 and the meal rate stays ৳0 no matter how much shopping is recorded — see
          &ldquo;Confirming cooking&rdquo; below, it trips up almost every new manager once.
        </p>
      </div>
    ),
  },
  {
    id: "shopping",
    title: "Adding shopping costs",
    body: (
      <div className="flex flex-col gap-2 text-[11px] font-semibold text-text-secondary">
        <p>
          Tap <span className="font-extrabold text-text">+ Shopping</span> at the top of this page. This
          records what was actually spent on groceries — it&rsquo;s the number on top of the meal-rate
          division, so it directly decides how much everyone pays per meal.
        </p>
        <p>
          Members can also submit their own shopping cost from their <span className="font-extrabold text-text">Shopping</span> page
          (usually whoever&rsquo;s on shopping duty that day). Either way:
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <Step n={1}>
            <span className="font-extrabold text-text">You (the manager) record it</span> — it&rsquo;s
            automatically approved and counts immediately.
          </Step>
          <Step n={2}>
            <span className="font-extrabold text-text">A member submits it</span> — it sits as
            &ldquo;Awaiting approval&rdquo; under &ldquo;Shopping costs&rdquo; below until you approve it
            (Approvals tab). Unapproved costs never affect the meal rate or anyone&rsquo;s bill — that&rsquo;s
            deliberate, so a mistyped number can&rsquo;t silently move everyone&rsquo;s bill.
          </Step>
        </div>
        <p>
          Whoever shopped gets that amount credited back against their own meal cost when bills are
          generated — so the person who shopped isn&rsquo;t charged twice for the same food.
        </p>
        <p>
          Already-approved amount wrong? Use <span className="font-extrabold text-text">Edit</span> next to
          that entry — it&rsquo;s a member vote, not an instant change, so the group agrees before it moves
          anyone&rsquo;s bill.
        </p>
      </div>
    ),
  },
  {
    id: "cooking",
    title: "Confirming cooking (do this daily!)",
    body: (
      <div className="flex flex-col gap-2 text-[11px] font-semibold text-text-secondary">
        <p>
          A member turning their meal &ldquo;on&rdquo; only reserves a seat — it does <span className="font-extrabold text-text">not</span> count
          toward the meal rate, the cooking count, or anyone&rsquo;s bill until you confirm that meal was
          actually cooked.
        </p>
        <p>
          Go to <span className="font-extrabold text-text">Meals → Cooking Count</span>, and for each meal
          slot tap <span className="font-extrabold text-text">Cooked</span> (or{" "}
          <span className="font-extrabold text-text">Reported not cooked</span> if the cook was absent that
          day). Do this once a day and everything downstream — meal totals, average cost, bills — stays
          accurate automatically.
        </p>
        <p>
          Fallen behind on a few days? Cooking Count has a{" "}
          <span className="font-extrabold text-text">Bulk confirm</span> button — pick a date range and
          confirm every already-cooked, undecided meal in it in one action, without disturbing any day
          you&rsquo;ve already handled.
        </p>
      </div>
    ),
  },
  {
    id: "expenses",
    title: "Recording expenses",
    body: (
      <div className="flex flex-col gap-2 text-[11px] font-semibold text-text-secondary">
        <p>
          Tap <span className="font-extrabold text-text">+ Expense</span> for anything that isn&rsquo;t
          grocery shopping — electricity, water, WiFi, gas, cleaning, cook salary, or a catch-all
          &ldquo;Others&rdquo;/&ldquo;Utilities&rdquo; charge.
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <Step n={1}>
            <span className="font-extrabold text-text">Category</span> decides where it lands on the bill:
            &ldquo;Salary&rdquo; becomes each member&rsquo;s Cook salary line, everything else (Electricity,
            Water, WiFi, Gas, Cleaning, Utilities, Others) becomes Service charge. Only{" "}
            <span className="font-extrabold text-text">Grocery</span> is never billed to members at all — use
            it just to keep a private record, not the{" "}
            <span className="font-extrabold text-text">+ Shopping</span> costs that actually set the meal
            rate.
          </Step>
          <Step n={2}>
            <span className="font-extrabold text-text">Bill in month</span> is when it shows up and gets
            charged — handy for a bill that arrives late (e.g. record a June electricity bill that only
            arrived in July, billed in July).
          </Step>
          <Step n={3}>
            <span className="font-extrabold text-text">Split</span>: &ldquo;Equal split&rdquo; divides the
            total you enter across everyone selected; &ldquo;Fixed per person&rdquo; charges that exact
            amount to each selected member.
          </Step>
          <Step n={4}>
            Pick which members it applies to — leave out anyone it shouldn&rsquo;t be charged to.
          </Step>
        </div>
        <p>
          Once an expense has been folded into a generated bill it locks (🔒) and can&rsquo;t be deleted —
          add a new one and regenerate bills instead, so nobody&rsquo;s bill silently changes after the
          fact.
        </p>
      </div>
    ),
  },
  {
    id: "generate",
    title: "Generating bills",
    body: (
      <div className="flex flex-col gap-2 text-[11px] font-semibold text-text-secondary">
        <p>
          Once shopping and cooking are up to date for the month, tap{" "}
          <span className="font-extrabold text-text">Generate bills</span>. Each member&rsquo;s bill adds up:
        </p>
        <div className="flex flex-col gap-1.5 rounded-btn bg-bg p-3">
          <div className="flex justify-between"><span className="font-extrabold text-text">Meal cost</span><span>meals eaten × this month&rsquo;s rate, minus their own approved shopping</span></div>
          <div className="flex justify-between"><span className="font-extrabold text-text">Room rent</span><span>their room&rsquo;s seat rent</span></div>
          <div className="flex justify-between"><span className="font-extrabold text-text">Service charge</span><span>their share of Utilities-type expenses + owner&rsquo;s flat monthly fee</span></div>
          <div className="flex justify-between"><span className="font-extrabold text-text">Cook salary</span><span>their share of Salary expenses</span></div>
        </div>
        <p>
          Plus any unpaid balance carried forward from last month, and (on a member&rsquo;s very first bill,
          if the hostel requires it) one month of advance rent.
        </p>
        <p>
          You can regenerate for the same month later — new/newly-approved shopping and expenses get
          picked up, but anything already billed stays locked so it&rsquo;s never silently changed.
        </p>
      </div>
    ),
  },
  {
    id: "after",
    title: "After bills are generated",
    body: (
      <div className="flex flex-col gap-2 text-[11px] font-semibold text-text-secondary">
        <p>
          Tap a member&rsquo;s bill below to see the full breakdown and its due date. From here you can:
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <Step n={1}>
            <span className="font-extrabold text-text">Turn off meals until paid</span> — for a member still
            owing money; they can&rsquo;t turn their own meals back on until you resume them.
          </Step>
          <Step n={2}>
            <span className="font-extrabold text-text">Settle</span> a meal-cost credit (someone who shopped
            more than they owe) — refund it, or apply it toward another category on the same bill.
          </Step>
          <Step n={3}>
            For a member who&rsquo;s left, their final balance shows under{" "}
            <span className="font-extrabold text-text">Former members</span> — record their last payment or
            refund a credit there.
          </Step>
        </div>
        <p>Payments a member submits themselves need your verification under Approvals before they count.</p>
      </div>
    ),
  },
];

export function BillingInstructionsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [expanded, setExpanded] = useState<string | null>("overview");

  return (
    <Sheet open={open} onClose={onClose} title="Billing instructions">
      <div className="flex flex-col gap-2.5">
        {SECTIONS.map((s) => {
          const isOpen = expanded === s.id;
          return (
            <div key={s.id} className="rounded-btn border border-border">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : s.id)}
                className="flex w-full items-center justify-between px-3 py-3 text-left"
              >
                <div className="text-[12px] font-extrabold">{s.title}</div>
                <Icon icon={isOpen ? ChevronUp : ChevronDown} size={16} className="shrink-0 text-text-secondary" />
              </button>
              {isOpen && <div className="border-t border-border px-3 py-3">{s.body}</div>}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

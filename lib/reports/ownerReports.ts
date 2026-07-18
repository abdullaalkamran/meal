// Pure builders for the owner's report tables — one shared { title, columns,
// rows } shape feeds the on-screen table renderer, the CSV download, and the
// print view, so the three can never drift apart.

import type {
  Bill,
  Expense,
  Hostel,
  MealDay,
  MealSlot,
  Payment,
  Room,
  ShoppingCost,
  User,
} from "@/lib/data";
import { formatShortDate } from "@/lib/utils/date";

export const REPORT_TYPES = [
  "Daily report",
  "Meal report",
  "Shopping report",
  "Expense report",
  "Payment report",
  "Outstanding report",
  "Student report",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export interface ReportTable {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

/** Everything the builders need, gathered once by the reports page for the
 * selected month + hostel filter. */
export interface ReportInputs {
  month: string; // YYYY-MM
  date: string; // today, YYYY-MM-DD
  hostels: Hostel[];
  usersByHostel: Record<string, User[]>;
  roomsByHostel: Record<string, Room[]>;
  /** The selected month's meal days. */
  mealDaysByHostel: Record<string, MealDay[]>;
  /** Expenses with billingMonth === month. */
  expensesByHostel: Record<string, Expense[]>;
  shoppingByHostel: Record<string, ShoppingCost[]>;
  /** The selected month's bills. */
  billsByHostel: Record<string, Bill[]>;
  paymentsByBill: Record<string, Payment[]>;
}

const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];

// "Fixed per person" expenses charge e.amount to EACH selected member, so the
// real total impact is e.amount × member count (same math as the finance page).
const expenseImpact = (e: Expense) => (e.splitMode === "fixed" ? e.amount * e.memberIds.length : e.amount);

const nameOf = (inputs: ReportInputs, hostelId: string, userId: string) =>
  inputs.usersByHostel[hostelId]?.find((u) => u.id === userId)?.name ?? userId;

function dailyReport(inputs: ReportInputs): ReportTable {
  const rows = inputs.hostels.map((h) => {
    const day = inputs.mealDaysByHostel[h.id]?.find((d) => d.date === inputs.date);
    const entries = day ? Object.values(day.entries) : [];
    const counts = SLOTS.map((meal) =>
      entries.reduce((sum, e) => sum + ((e[meal].on ? 1 : 0) + e[meal].guestCount), 0)
    );
    const expensesToday = (inputs.expensesByHostel[h.id] ?? [])
      .filter((e) => e.dateFrom <= inputs.date && inputs.date <= e.dateTo)
      .reduce((sum, e) => sum + expenseImpact(e), 0);
    const paymentsToday = (inputs.billsByHostel[h.id] ?? [])
      .flatMap((b) => inputs.paymentsByBill[b.id] ?? [])
      .filter((p) => p.paidAt.startsWith(inputs.date))
      .reduce((sum, p) => sum + p.amount, 0);
    return [h.name, ...counts, counts.reduce((a, b) => a + b, 0), expensesToday, paymentsToday];
  });
  return {
    title: `Daily report · ${formatShortDate(inputs.date)}`,
    columns: ["Hostel", "Breakfast", "Lunch", "Dinner", "Total meals", "Expenses today (৳)", "Payments today (৳)"],
    rows,
  };
}

function mealReport(inputs: ReportInputs): ReportTable {
  const rows: (string | number)[][] = [];
  for (const h of inputs.hostels) {
    const boarders = (inputs.usersByHostel[h.id] ?? []).filter(
      (u) => u.role !== "cook" && u.role !== "owner"
    );
    for (const u of boarders) {
      let own = 0;
      let guests = 0;
      for (const day of inputs.mealDaysByHostel[h.id] ?? []) {
        const entry = day.entries[u.id];
        if (!entry) continue;
        for (const slot of SLOTS) {
          if (entry[slot].on) own += 1;
          // Guests count even when the host's own meal is off.
          guests += entry[slot].guestCount;
        }
      }
      rows.push([h.name, u.name, own, guests, own + guests]);
    }
  }
  return {
    title: "Meal report",
    columns: ["Hostel", "Member", "Own meals", "Guest meals", "Total"],
    rows,
  };
}

function shoppingReport(inputs: ReportInputs): ReportTable {
  const rows: (string | number)[][] = [];
  for (const h of inputs.hostels) {
    const costs = (inputs.shoppingByHostel[h.id] ?? []).filter((c) =>
      c.dates.some((d) => d.startsWith(inputs.month))
    );
    for (const c of costs) {
      rows.push([
        h.name,
        c.dates.map(formatShortDate).join(", "),
        nameOf(inputs, h.id, c.userId),
        c.items ?? "—",
        c.amount,
      ]);
    }
  }
  return {
    title: "Shopping report",
    columns: ["Hostel", "Dates", "Shopper", "Items", "Amount (৳)"],
    rows,
  };
}

function expenseReport(inputs: ReportInputs): ReportTable {
  const rows: (string | number)[][] = [];
  for (const h of inputs.hostels) {
    for (const e of inputs.expensesByHostel[h.id] ?? []) {
      rows.push([
        h.name,
        e.category,
        e.note ?? "—",
        e.dateFrom === e.dateTo ? formatShortDate(e.dateFrom) : `${formatShortDate(e.dateFrom)} – ${formatShortDate(e.dateTo)}`,
        e.splitMode === "fixed" ? `Fixed × ${e.memberIds.length}` : `Equal ÷ ${e.memberIds.length}`,
        expenseImpact(e),
      ]);
    }
  }
  return {
    title: "Expense report",
    columns: ["Hostel", "Category", "Note", "Period", "Split", "Total (৳)"],
    rows,
  };
}

function paymentReport(inputs: ReportInputs): ReportTable {
  const rows: (string | number)[][] = [];
  for (const h of inputs.hostels) {
    for (const b of inputs.billsByHostel[h.id] ?? []) {
      for (const p of inputs.paymentsByBill[b.id] ?? []) {
        rows.push([
          h.name,
          nameOf(inputs, h.id, b.userId),
          p.amount,
          p.method,
          p.paidAt.slice(0, 10),
          p.verified ? "Verified" : "Pending",
        ]);
      }
    }
  }
  return {
    title: "Payment report",
    columns: ["Hostel", "Member", "Amount (৳)", "Method", "Date", "Status"],
    rows,
  };
}

function outstandingReport(inputs: ReportInputs): ReportTable {
  const rows: (string | number)[][] = [];
  for (const h of inputs.hostels) {
    for (const b of inputs.billsByHostel[h.id] ?? []) {
      const due = b.grandTotal - b.paid;
      if (due <= 0) continue;
      rows.push([h.name, nameOf(inputs, h.id, b.userId), b.grandTotal, b.paid, due, b.dueDate ?? "—"]);
    }
  }
  return {
    title: "Outstanding report",
    columns: ["Hostel", "Member", "Billed (৳)", "Paid (৳)", "Due (৳)", "Last day"],
    rows,
  };
}

function studentReport(inputs: ReportInputs): ReportTable {
  const rows: (string | number)[][] = [];
  for (const h of inputs.hostels) {
    const students = (inputs.usersByHostel[h.id] ?? []).filter((u) => u.role === "student");
    for (const u of students) {
      const room = inputs.roomsByHostel[h.id]?.find((r) => r.id === u.roomId);
      const bill = inputs.billsByHostel[h.id]?.find((b) => b.userId === u.id);
      rows.push([
        h.name,
        u.name,
        room ? `Room ${room.number}` : "Unassigned",
        u.joinedAt ? formatShortDate(u.joinedAt) : "—",
        bill?.mealsCount ?? 0,
        bill ? Math.max(bill.grandTotal - bill.paid, 0) : 0,
        u.banned ? "Banned" : "Active",
      ]);
    }
  }
  return {
    title: "Student report",
    columns: ["Hostel", "Student", "Room", "Joined", "Meals billed", "Due (৳)", "Status"],
    rows,
  };
}

export function buildReport(type: ReportType, inputs: ReportInputs): ReportTable {
  switch (type) {
    case "Daily report":
      return dailyReport(inputs);
    case "Meal report":
      return mealReport(inputs);
    case "Shopping report":
      return shoppingReport(inputs);
    case "Expense report":
      return expenseReport(inputs);
    case "Payment report":
      return paymentReport(inputs);
    case "Outstanding report":
      return outstandingReport(inputs);
    case "Student report":
      return studentReport(inputs);
  }
}

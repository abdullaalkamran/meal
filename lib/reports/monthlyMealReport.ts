// The monthly meal-settlement report — one calculation shared by the manager
// page (all members), the owner page (all members, any hostel), and the
// student page (own row only), plus its CSV export shape.
//
// The math follows the hostel's real cash flow for a month:
//   avg meal rate       = total shopping spend ÷ total meals eaten (own+guest)
//   member meal cost    = avg meal rate × member's total meals
//   member meal balance = member's shopping spend − member meal cost
//                         (+ = credit the hostel owes them, − = due they owe)
// The manager collects from members with dues and pays out members with
// credit. Rent / service charge / cook salary / previous balance come from
// the month's generated bill when one exists.

import { repo } from "@/lib/data";
import { formatMonthLabel } from "@/lib/utils/date";
import type { ReportTable } from "./ownerReports";

export interface MemberMonthlyReport {
  userId: string;
  name: string;
  isManager: boolean;
  room: string;
  totalMeals: number; // confirmed-cooked meals (own + guest) billed this month
  mealCost: number; // avgMealRate × totalMeals
  shoppingSpent: number; // what they personally spent on duty shopping
  mealBalance: number; // shoppingSpent − mealCost (+credit / −due)
  rent: number;
  /** The roomRent section's own line items, exactly as billed — labelled with
   * whichever month the manager actually billed (normally this month, but
   * "Generate bills" can bill a different month's rent in advance, e.g. next
   * month's rent inside this month's bill — reusing the bill's own label here
   * instead of assuming it always matches the report's month avoids a
   * mismatched "Rent · <wrong month>" line). */
  rentItems: { label: string; amount: number }[];
  serviceCharge: number;
  /** The service-charge section EXACTLY as billed — each line item from bill
   * generation (owner monthly charge, water bill, gas bill, cleaning, …). */
  serviceItems: { label: string; amount: number }[];
  cookSalary: number;
  previousDue: number; // unpaid carry-over from earlier months
  billTotal: number; // grand total on the month's bill (0 if not generated)
  paid: number;
  /** What's still unpaid for rent + service charge + cook salary + previous
   * balance — deliberately EXCLUDES meal cost. Meal cost is money collected
   * purely on members' behalf (the hostel keeps no share of it), so a due or
   * credit there is a completely separate account from what's owed to the
   * owner/utilities/cook — see `mealBalance` for that side. */
  outstanding: number;
}

export interface MonthlyMealReport {
  month: string;
  hostelId: string;
  hostelName: string;
  totalShopping: number;
  totalMeals: number;
  avgMealRate: number;
  totalDue: number; // Σ outstanding bill amounts
  totalCredit: number; // Σ positive meal balances the manager must pay out
  billsGenerated: boolean;
  /** Every distinct service-charge line label billed this month, in first-seen
   * order — drives one report column per item (water, gas, cleaning, …). */
  serviceItemLabels: string[];
  members: MemberMonthlyReport[];
}

export async function buildMonthlyMealReport(
  hostelId: string,
  month: string
): Promise<MonthlyMealReport | null> {
  const hostel = await repo.hostels.getHostel(hostelId);
  if (!hostel) return null;

  const [users, rooms, shoppingCosts, bills, rateInfo] = await Promise.all([
    repo.users.listByHostel(hostelId),
    repo.rooms.listByHostel(hostelId),
    repo.shoppingCosts.listByHostel(hostelId),
    repo.bills.listByHostel(hostelId, month),
    repo.meals.getActualMealRate(hostelId, month),
  ]);

  // Boarders eat meals; cooks are staff.
  const boarders = users.filter((u) => u.role !== "cook" && !u.banned);
  const inMonth = (date: string) => date.startsWith(month);
  // Only APPROVED shopping counts toward the rate/spend — the same money the
  // bills use. Pending/denied costs are excluded until the manager approves.
  const monthCosts = shoppingCosts.filter((c) => c.status === "approved" && c.dates.some(inMonth));

  // Hostel-wide rate/spend/meals straight from the billing source of truth:
  // total = approved shopping ÷ CONFIRMED-COOKED meals (own + guest).
  const { rate: avgMealRate, totalShopping, totalMeals } = rateInfo;

  // Per-member "eaten" = only meals the manager confirmed were cooked, from the
  // member's join date — exactly what the bill charges, NOT every toggled-on
  // slot (which would count uncooked, pre-join and future days). Reusing the
  // same summary the bill uses keeps the report reconciled with bills.
  const summaries = new Map(
    await Promise.all(
      boarders.map((u) =>
        repo.meals.getMemberMealSummary(hostelId, u.id, month).then((s) => [u.id, s] as const)
      )
    )
  );

  const members: MemberMonthlyReport[] = boarders.map((u) => {
    const summary = summaries.get(u.id);
    const memberMeals = summary?.billedMeals ?? 0;
    const mealCost = summary?.cost ?? 0;
    const shoppingSpent = monthCosts
      .filter((c) => c.userId === u.id)
      .reduce((sum, c) => sum + c.amount, 0);
    const bill = bills.find((b) => b.userId === u.id);
    const section = (label: string) =>
      bill?.sections.find((s) => s.label === label)?.total ?? 0;
    const sectionPaid = (label: string) =>
      bill?.sections.find((s) => s.label === label)?.paid ?? 0;
    const room = rooms.find((r) => r.occupantIds.includes(u.id));

    // Service charge itemized exactly as billed; before bills exist, the only
    // known standing item is the owner's monthly charge.
    const ownerCharge = hostel.settings.serviceChargeMonthly ?? 0;
    const serviceItems = bill
      ? bill.sections.find((s) => s.label === "serviceCharge")?.items ?? []
      : ownerCharge > 0
        ? [{ label: "Monthly service charge (set by owner)", amount: ownerCharge }]
        : [];

    const rentTotal = bill ? section("roomRent") : room?.seatRent ?? 0;
    const serviceTotal = bill ? section("serviceCharge") : serviceItems.reduce((sum, i) => sum + i.amount, 0);
    const cookSalaryTotal = section("cookSalary");
    const previousDue = bill ? Math.max(bill.previousBalance - bill.previousBalancePaid, 0) : 0;
    // Rent/service/cook-salary/previous-balance due only — meal cost (whether
    // a due or a credit) never folds into this figure; it's the manager's
    // explicit call to settle a meal credit against another category.
    const outstanding =
      Math.max(rentTotal - sectionPaid("roomRent"), 0) +
      Math.max(serviceTotal - sectionPaid("serviceCharge"), 0) +
      Math.max(cookSalaryTotal - sectionPaid("cookSalary"), 0) +
      previousDue;

    return {
      userId: u.id,
      name: u.name,
      isManager: u.role === "manager",
      room: room ? `Room ${room.number}` : "Unassigned",
      totalMeals: memberMeals,
      mealCost,
      shoppingSpent,
      mealBalance: shoppingSpent - mealCost,
      rent: rentTotal,
      rentItems: bill
        ? bill.sections.find((s) => s.label === "roomRent")?.items ?? []
        : room?.seatRent
          ? [{ label: `Room ${room.number} (seat) · ${formatMonthLabel(month)}`, amount: room.seatRent }]
          : [],
      serviceCharge: serviceTotal,
      serviceItems,
      cookSalary: cookSalaryTotal,
      previousDue,
      billTotal: bill?.grandTotal ?? 0,
      paid: bill?.paid ?? 0,
      outstanding,
    };
  });

  const serviceItemLabels: string[] = [];
  for (const m of members) {
    for (const item of m.serviceItems) {
      if (!serviceItemLabels.includes(item.label)) serviceItemLabels.push(item.label);
    }
  }

  return {
    month,
    hostelId,
    hostelName: hostel.name,
    totalShopping,
    totalMeals,
    avgMealRate,
    totalDue: members.reduce((sum, m) => sum + m.outstanding, 0),
    totalCredit: members.reduce((sum, m) => sum + Math.max(m.mealBalance, 0), 0),
    billsGenerated: bills.length > 0,
    serviceItemLabels,
    members,
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** CSV/table shape for the download — one row per member (or just one member
 * for a student's own export). */
export function mealReportTable(
  report: MonthlyMealReport,
  onlyUserId?: string
): ReportTable {
  const serviceAmount = (m: MemberMonthlyReport, label: string) =>
    m.serviceItems.find((i) => i.label === label)?.amount ?? 0;
  const rows = report.members
    .filter((m) => !onlyUserId || m.userId === onlyUserId)
    .map((m) => [
      m.name,
      m.room,
      m.totalMeals,
      round(m.mealCost),
      round(m.shoppingSpent),
      round(m.mealBalance),
      round(m.rent),
      ...report.serviceItemLabels.map((label) => round(serviceAmount(m, label))),
      round(m.serviceCharge),
      round(m.cookSalary),
      round(m.previousDue),
      round(m.billTotal),
      round(m.paid),
      round(m.outstanding),
    ]);
  return {
    title: `Monthly meal report · ${report.hostelName} · ${report.month}`,
    columns: [
      "Member",
      "Room",
      "Total meals",
      "Meal cost (৳)",
      "Shopping spent (৳)",
      "Meal credit/due (৳)",
      "Rent (৳)",
      // One column per billed service item — water, gas, cleaning, owner
      // charge, … exactly as they appear on the generated bill.
      ...report.serviceItemLabels.map((label) => `${label} (৳)`),
      "Service total (৳)",
      "Cook salary (৳)",
      "Previous due (৳)",
      "Bill total (৳)",
      "Paid (৳)",
      "Outstanding (৳)",
    ],
    rows,
  };
}

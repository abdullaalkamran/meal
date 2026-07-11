// The full set of expense categories offered when recording an expense, and
// which of them count as a "service charge" (billed to members' bills the
// same way Utilities always has) versus Salary (cook salary) or a plain
// ledger entry never billed to members (Grocery only).

export const EXPENSE_CATEGORIES = [
  "Grocery",
  "Electricity",
  "Water",
  "WiFi",
  "Gas",
  "Cleaning",
  "Utilities",
  "Salary",
  "Others",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** Any expense in one of these categories feeds a member's "Service charge"
 * bill section, split per its own memberIds/splitMode — "Utilities" and
 * "Others" are kept as generic catch-alls alongside the more specific bill
 * types. Only "Grocery" is never billed to members. */
export const SERVICE_CHARGE_CATEGORIES: readonly string[] = [
  "Electricity",
  "Water",
  "WiFi",
  "Gas",
  "Cleaning",
  "Utilities",
  "Others",
];

export function isServiceChargeCategory(category: string): boolean {
  return SERVICE_CHARGE_CATEGORIES.includes(category);
}

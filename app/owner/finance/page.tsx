"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth/SessionProvider";
import { useHostelsByOwner } from "@/hooks/useHostel";
import { Card } from "@/components/ui/Card";
import { HostelPicker } from "@/components/hostel/HostelPicker";
import { FinanceScreen } from "@/components/hostel/FinanceScreen";

/** The owner's native Finance tab — generate bills, record payments/expenses/
 * shopping costs, settle meal credits, directly on their own hostel(s)
 * instead of asking the manager for every day-to-day money action. A multi-
 * hostel owner switches with the picker chips; `activeHostelId` (set by
 * switchHostel) is what FinanceScreen actually reads from. */
export default function OwnerFinancePage() {
  const { user } = useSession();
  const hostels = useHostelsByOwner(user?.id);

  // A brand-new owner has no hostels yet — show a pointer, not a blank page.
  if (hostels.length === 0) {
    return (
      <div className="flex flex-col gap-5 pt-2">
        <div className="text-[17.5px] font-extrabold tracking-tight">Finance</div>
        <Card className="text-center">
          <div className="mb-1 text-[12.5px] font-extrabold">No hostels yet</div>
          <div className="mb-3 text-[11px] font-semibold text-text-secondary">
            Add your first hostel to start generating bills and recording expenses.
          </div>
          <Link
            href="/owner/hostels"
            className="inline-flex min-h-10 items-center justify-center rounded-btn bg-primary px-5 text-[11.5px] font-extrabold text-white"
          >
            Go to Hostels
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <HostelPicker hideIfSingle />
      <FinanceScreen role="owner" />
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Building2, ChevronRight } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useHostelsByOwner } from "@/hooks/useHostel";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { HostelPicker } from "@/components/hostel/HostelPicker";
import { MealReportScreen } from "@/components/hostel/MealReportScreen";

/** The owner's Reports tab IS the monthly meal report — the same table the
 * manager gets. A multi-hostel owner first picks which hostel to generate it
 * for; the picker chips stay above for switching afterwards. The old
 * per-type breakdowns live on the Analytics page linked below. */
export default function OwnerReportsPage() {
  const { user, switchHostel } = useSession();
  const hostels = useHostelsByOwner(user?.id);
  const [chosen, setChosen] = useState(false);
  const multiple = hostels.length > 1;

  const analyticsLink = (
    <Link
      href="/owner/analytics"
      className="flex items-center justify-between rounded-card border border-border bg-card p-4 shadow-chip"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
          <Icon icon={BarChart3} size={17} />
        </div>
        <div>
          <div className="text-[12px] font-extrabold">Detailed analytics</div>
          <div className="text-[10px] font-semibold text-text-secondary">
            Daily, shopping, expense, payment &amp; roster breakdowns
          </div>
        </div>
      </div>
      <Icon icon={ChevronRight} size={16} className="shrink-0 text-text-secondary" />
    </Link>
  );

  // A brand-new owner has no hostels yet — show a pointer, not a blank page.
  if (hostels.length === 0) {
    return (
      <div className="flex flex-col gap-5 pt-2">
        <div className="text-[17.5px] font-extrabold tracking-tight">Monthly report</div>
        <Card className="text-center">
          <div className="mb-1 text-[12.5px] font-extrabold">No hostels yet</div>
          <div className="mb-3 text-[11px] font-semibold text-text-secondary">
            Add your first hostel and the monthly meal report will be generated from its data.
          </div>
          <Link
            href="/owner/hostels"
            className="inline-flex min-h-10 items-center justify-center rounded-btn bg-primary px-5 text-[11.5px] font-extrabold text-white"
          >
            Go to Hostels
          </Link>
        </Card>
        {analyticsLink}
      </div>
    );
  }

  if (multiple && !chosen) {
    return (
      <div className="flex flex-col gap-5 pt-2">
        <div>
          <div className="text-[17.5px] font-extrabold tracking-tight">Monthly report</div>
          <div className="text-[10.5px] font-semibold text-text-secondary">
            Choose which hostel to generate the report for
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {hostels.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => {
                switchHostel(h.id);
                setChosen(true);
              }}
              className="w-full text-left"
            >
              <Card className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <Icon icon={Building2} size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-extrabold">{h.name}</div>
                  <div className="text-[10px] font-semibold text-text-secondary">{h.area}</div>
                </div>
                <Icon icon={ChevronRight} size={16} className="shrink-0 text-text-secondary" />
              </Card>
            </button>
          ))}
        </div>
        {analyticsLink}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      {multiple && <HostelPicker />}
      <MealReportScreen scope="all" />
      {analyticsLink}
    </div>
  );
}

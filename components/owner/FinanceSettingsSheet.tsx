"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useHostel } from "@/hooks/useHostel";
import { repo } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";

/** Owner-only finance controls for one hostel. The monthly service charge is
 * billed flat to every boarder and managers can never edit it — bills simply
 * include it as a locked line item. */
export function FinanceSettingsSheet({
  open,
  onClose,
  hostelId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | null;
  onSaved?: () => void;
}) {
  const hostel = useHostel(hostelId ?? undefined);
  const [serviceCharge, setServiceCharge] = useState("");
  const [mealRate, setMealRate] = useState("");
  const [saving, setSaving] = useState(false);

  // Prefill once per open, but only after the live hostel record has actually
  // arrived (it loads async) — and never again on later hostel ticks, or
  // typing would be overwritten by our own saves echoing back.
  const prefilled = useRef(false);
  useEffect(() => {
    if (!open) {
      prefilled.current = false;
      return;
    }
    if (!hostel || prefilled.current) return;
    prefilled.current = true;
    queueMicrotask(() => {
      setServiceCharge(String(hostel.settings.serviceChargeMonthly ?? 0));
      setMealRate(String(hostel.mealRate));
    });
  }, [open, hostel]);

  if (!hostelId || !hostel) return null;

  const save = async () => {
    setSaving(true);
    const charge = Math.max(0, Number(serviceCharge) || 0);
    const rate = Math.max(0, Number(mealRate) || 0);
    await repo.hostels.updateSettings(hostel.id, { serviceChargeMonthly: charge });
    // A blank/zero meal rate is never intentional — meals are always charged.
    if (rate > 0 && rate !== hostel.mealRate) await repo.hostels.update(hostel.id, { mealRate: rate });
    setSaving(false);
    onSaved?.();
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Finance settings · ${hostel.name}`}>
      <div className="mb-4 rounded-btn bg-bg px-3 py-2.5 text-[10.5px] font-bold text-text-secondary">
        Only you can change these. The manager sees the service charge on generated bills but
        cannot edit or remove it.
      </div>

      <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        Monthly service charge (per boarder)
      </div>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={serviceCharge}
        onChange={(e) => setServiceCharge(e.target.value)}
        className="mb-1 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
      />
      <div className="mb-4 text-[9.5px] font-semibold text-text-secondary">
        Added to every boarder&rsquo;s bill as a locked line. Set 0 to charge nothing.
        {hostel.settings.serviceChargeMonthly ? (
          <> Currently {formatBDT(hostel.settings.serviceChargeMonthly)}/month.</>
        ) : null}
      </div>

      <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        Meal rate (per meal)
      </div>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={mealRate}
        onChange={(e) => setMealRate(e.target.value)}
        className="mb-4 w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold"
      />

      <Button fullWidth onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </Sheet>
  );
}

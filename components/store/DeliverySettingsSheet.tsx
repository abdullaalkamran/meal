"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { repo, type StoreSettings } from "@/lib/data";

const inputClass = "w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold";
const labelClass = "mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary";

/** Service Manager controls for the store-wide delivery fee: on/off, the flat
 * amount, and an optional "free above this subtotal" threshold. */
export function DeliverySettingsSheet({
  open,
  onClose,
  settings,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  settings: StoreSettings;
  onSaved?: () => void;
}) {
  const [enabled, setEnabled] = useState(true);
  const [fee, setFee] = useState("30");
  const [freeMin, setFreeMin] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setEnabled(settings.deliveryFeeEnabled);
      setFee(String(settings.deliveryFee));
      setFreeMin(settings.freeDeliveryMinAmount ? String(settings.freeDeliveryMinAmount) : "");
    });
  }, [open, settings]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await repo.storeSettings.update({
        deliveryFeeEnabled: enabled,
        deliveryFee: Math.max(0, Number(fee) || 0),
        freeDeliveryMinAmount: freeMin.trim() ? Math.max(0, Number(freeMin) || 0) : undefined,
      });
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Delivery & fees">
      <button
        type="button"
        onClick={() => setEnabled((v) => !v)}
        className="mb-4 flex w-full items-center gap-3 rounded-btn border border-border px-3 py-2.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-extrabold">Charge a delivery fee</div>
          <div className="text-[9.5px] font-semibold text-text-secondary">
            Off means every order ships free, no matter the size.
          </div>
        </div>
        <div
          className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
            enabled ? "bg-primary" : "bg-border"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
              enabled ? "left-[18px]" : "left-0.5"
            }`}
          />
        </div>
      </button>

      <div className={enabled ? "" : "opacity-50"}>
        <div className={labelClass}>Delivery fee (৳)</div>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          disabled={!enabled}
          className={`${inputClass} mb-3`}
        />

        <div className={labelClass}>Free delivery above (৳) · optional</div>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={freeMin}
          onChange={(e) => setFreeMin(e.target.value)}
          disabled={!enabled}
          placeholder="No threshold"
          className={`${inputClass} mb-1`}
        />
        <div className="mb-4 text-[9.5px] font-semibold text-text-secondary">
          Orders with a subtotal at or above this waive the delivery fee. Leave blank to always charge it.
        </div>
      </div>

      <Button fullWidth onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </Sheet>
  );
}

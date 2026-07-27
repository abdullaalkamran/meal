"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { repo, type Coupon } from "@/lib/data";

const inputClass = "w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold";
const labelClass = "mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary";

/** Create or edit a checkout coupon. `coupon` null = create. */
export function CouponFormSheet({
  open,
  onClose,
  coupon,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  coupon: Coupon | null;
  onSaved?: () => void;
}) {
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "flat">("percent");
  const [value, setValue] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setCode(coupon?.code ?? "");
      setKind(coupon?.kind ?? "percent");
      setValue(coupon ? String(coupon.value) : "");
      setMinOrderAmount(coupon?.minOrderAmount ? String(coupon.minOrderAmount) : "");
      setMaxUses(coupon?.maxUses !== undefined ? String(coupon.maxUses) : "");
      setExpiresAt(coupon?.expiresAt ?? "");
      setActive(coupon?.active ?? true);
      setError("");
    });
  }, [open, coupon]);

  const valid = code.trim().length > 0 && Number(value) > 0 && (kind === "flat" || Number(value) <= 100);

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    const patch = {
      code: code.trim(),
      kind,
      value: Number(value),
      active,
      minOrderAmount: minOrderAmount.trim() ? Number(minOrderAmount) : undefined,
      maxUses: maxUses.trim() ? Number(maxUses) : undefined,
      expiresAt: expiresAt.trim() || undefined,
    };
    try {
      if (coupon) await repo.coupons.update(coupon.id, patch);
      else await repo.coupons.add(patch);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this coupon.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={coupon ? "Edit coupon" : "New coupon"}>
      <div className={labelClass}>Code</div>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="WELCOME10"
        className={`${inputClass} mb-3 uppercase`}
      />

      <div className={labelClass}>Discount type</div>
      <div className="mb-3">
        <SegmentedControl
          options={[
            { value: "percent", label: "% Percent" },
            { value: "flat", label: "৳ Flat amount" },
          ]}
          value={kind}
          onChange={(v) => setKind(v as "percent" | "flat")}
        />
      </div>

      <div className={labelClass}>{kind === "percent" ? "Percent off (1–100)" : "Amount off (৳)"}</div>
      <input
        type="number"
        min={0}
        max={kind === "percent" ? 100 : undefined}
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={`${inputClass} mb-3`}
      />

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <div className={labelClass}>Min. order (৳)</div>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={minOrderAmount}
            onChange={(e) => setMinOrderAmount(e.target.value)}
            placeholder="None"
            className={inputClass}
          />
        </div>
        <div>
          <div className={labelClass}>Max uses</div>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="Unlimited"
            className={inputClass}
          />
        </div>
      </div>

      <div className={labelClass}>Expires · optional</div>
      <input
        type="date"
        value={expiresAt}
        onChange={(e) => setExpiresAt(e.target.value)}
        className={`${inputClass} mb-3`}
      />

      <button
        type="button"
        onClick={() => setActive((v) => !v)}
        className="mb-4 flex w-full items-center gap-3 rounded-btn border border-border px-3 py-2.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-extrabold">Active</div>
          <div className="text-[9.5px] font-semibold text-text-secondary">
            Off hides this from checkout without deleting it.
          </div>
        </div>
        <div className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${active ? "bg-primary" : "bg-border"}`}>
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${active ? "left-[18px]" : "left-0.5"}`}
          />
        </div>
      </button>

      {error && (
        <div className="mb-3 rounded-btn bg-danger-soft px-3 py-2 text-[10.5px] font-bold text-danger">{error}</div>
      )}

      <Button fullWidth onClick={save} disabled={!valid || saving}>
        {saving ? "Saving…" : coupon ? "Save changes" : "Create coupon"}
      </Button>
    </Sheet>
  );
}

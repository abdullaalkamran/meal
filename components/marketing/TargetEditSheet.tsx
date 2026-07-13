"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { repo } from "@/lib/data";

export function TargetEditSheet({
  open,
  onClose,
  metricKey,
  metricLabel,
  month,
  current,
}: {
  open: boolean;
  onClose: () => void;
  metricKey: string;
  metricLabel: string;
  month: string;
  current: number;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState(String(current));

  useEffect(() => {
    if (open) queueMicrotask(() => setValue(String(current)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, metricKey]);

  const submit = async () => {
    await repo.marketing.setTarget(metricKey, month, Number(value) || 0);
    toast(`${metricLabel} target updated`);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Set target · ${metricLabel}`}>
      <div className="mb-1.5 text-[10.5px] font-extrabold text-text-secondary">TARGET FOR THIS MONTH</div>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mb-4 w-full rounded-btn border border-primary px-3 py-3 text-[16.5px] font-extrabold"
      />
      <Button fullWidth onClick={submit}>
        Save target
      </Button>
    </Sheet>
  );
}

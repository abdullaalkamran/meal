"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { ServiceAreaPicker } from "@/components/ui/ServiceAreaPicker";
import { repo, type GeoArea } from "@/lib/data";

/** Where one quick-action tile is available. Reuses the same
 * division/district/thana multi-select as service-manager permissions
 * (ServicePermissionsSheet) — adding an area is a couple of taps, and each
 * added area shows as a removable chip. */
export function QuickServiceAreasSheet({
  open,
  onClose,
  actionKey,
  actionLabel,
  initialAreas,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  actionKey: string | null;
  actionLabel: string;
  initialAreas: GeoArea[];
  onSaved?: () => void;
}) {
  const [areas, setAreas] = useState<GeoArea[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => setAreas(initialAreas));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, actionKey]);

  if (!actionKey) return null;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await repo.quickServices.update(actionKey, { areas });
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Locations · ${actionLabel}`}>
      <div className="mb-4 rounded-btn bg-bg px-3 py-2.5 text-[10px] font-semibold text-text-secondary">
        Where this tile shows up on members&rsquo; home page. Nothing selected
        means available everywhere.
      </div>
      <div className="mb-4">
        <ServiceAreaPicker value={areas} onChange={setAreas} />
      </div>
      <Button fullWidth onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save locations"}
      </Button>
    </Sheet>
  );
}

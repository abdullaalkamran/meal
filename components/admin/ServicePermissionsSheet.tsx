"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { ServiceKindPicker } from "@/components/ui/ServiceKindPicker";
import { ServiceAreaPicker } from "@/components/ui/ServiceAreaPicker";
import { repo, type GeoArea, type ServiceKind, type User } from "@/lib/data";

/** Super Admin assigns which service-catalog kinds and regions a Service
 * Manager is responsible for. Informational only for now — app/service/*
 * still shows everything to any Service Manager regardless of this. */
export function ServicePermissionsSheet({
  open,
  onClose,
  user,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  user: User | null;
  onSaved?: () => void;
}) {
  const [kinds, setKinds] = useState<ServiceKind[]>([]);
  const [areas, setAreas] = useState<GeoArea[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    queueMicrotask(() => {
      setKinds(user.serviceKinds ?? []);
      setAreas(user.serviceAreas ?? []);
    });
  }, [open, user]);

  if (!user) return null;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await repo.users.setServicePermissions(user.id, { kinds, areas });
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Permissions · ${user.name}`}>
      <div className="mb-4 rounded-btn bg-bg px-3 py-2.5 text-[10px] font-semibold text-text-secondary">
        Which of the platform&rsquo;s service offerings and regions {user.name.split(" ")[0]} manages.
        Nothing selected means no restriction — every type, every region.
      </div>

      <div className="mb-4">
        <ServiceKindPicker value={kinds} onChange={setKinds} />
      </div>

      <div className="mb-4">
        <ServiceAreaPicker value={areas} onChange={setAreas} />
      </div>

      <Button fullWidth onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save permissions"}
      </Button>
    </Sheet>
  );
}

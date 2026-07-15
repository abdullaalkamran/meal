"use client";

import { Sheet } from "@/components/ui/Sheet";
import { Switch } from "@/components/ui/Switch";
import { useHostel } from "@/hooks/useHostel";
import { repo } from "@/lib/data";
import { DEFAULT_MANAGER_PERMISSIONS, PERMISSION_OPTIONS } from "@/lib/auth/permissions";

/** Owner control: what this hostel's manager is allowed to do. Subscribes to
 * the live hostel record so consecutive toggles never work from a stale
 * permissions snapshot; switches save immediately. */
export function ManagerPermissionsSheet({
  open,
  onClose,
  hostelId,
  managerName,
}: {
  open: boolean;
  onClose: () => void;
  hostelId: string | null;
  managerName?: string;
}) {
  const hostel = useHostel(hostelId ?? undefined);

  if (!hostelId || !hostel) return null;
  const perms = { ...DEFAULT_MANAGER_PERMISSIONS, ...hostel.settings.managerPermissions };

  return (
    <Sheet open={open} onClose={onClose} title="Manager permissions">
      <div className="mb-3 rounded-btn bg-bg px-3 py-2.5 text-[10.5px] font-bold text-text-secondary">
        What {managerName ?? "the manager"} can do in {hostel.name}. You always keep full access.
      </div>
      <div className="flex flex-col gap-2">
        {PERMISSION_OPTIONS.map((opt) => (
          <div key={opt.key} className="flex items-center justify-between gap-3 rounded-btn border border-border px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-[11.5px] font-extrabold">{opt.label}</div>
              <div className="text-[9.5px] font-semibold text-text-secondary">{opt.hint}</div>
            </div>
            <Switch
              checked={perms[opt.key]}
              onChange={(checked) =>
                repo.hostels.updateSettings(hostel.id, {
                  managerPermissions: { ...perms, [opt.key]: checked },
                })
              }
            />
          </div>
        ))}
      </div>
    </Sheet>
  );
}

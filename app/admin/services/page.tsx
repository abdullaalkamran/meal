"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Switch } from "@/components/ui/Switch";
import { QuickServiceAreasSheet } from "@/components/admin/QuickServiceAreasSheet";
import { useQuickServices } from "@/hooks/useQuickServices";
import { QUICK_ACTION_TONE_CLASSES, QUICK_SERVICE_ACTIONS } from "@/lib/quickActions";
import { formatArea } from "@/lib/geo/bangladesh";
import { repo } from "@/lib/data";

/** Super Admin turns each "Quick action" tile on the member home page on/off,
 * and restricts where it shows — e.g. "Find Cook" only in Dhaka & Chattogram,
 * while other hostels' members don't see the tile at all. */
export default function AdminServicesPage() {
  const settings = useQuickServices();
  const [areasKey, setAreasKey] = useState<string | null>(null);
  const activeAction = QUICK_SERVICE_ACTIONS.find((a) => a.key === areasKey);

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Quick services</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          Enable/disable each home-page tile, and restrict it to specific regions.
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {QUICK_SERVICE_ACTIONS.map((a) => {
          const s = settings[a.key];
          const enabled = s?.enabled ?? true;
          const areas = s?.areas ?? [];
          return (
            <Card key={a.key}>
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${QUICK_ACTION_TONE_CLASSES[a.tone]}`}
                >
                  <Icon icon={a.icon} size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-extrabold">{a.label}</div>
                  <div className="truncate text-[9.5px] font-semibold text-text-secondary">
                    {areas.length ? areas.map((ar) => formatArea(ar)).join(", ") : "All regions"}
                  </div>
                </div>
                <Switch
                  checked={enabled}
                  onChange={(checked) => repo.quickServices.update(a.key, { enabled: checked })}
                />
              </div>
              <div className="mt-2.5 border-t border-border pt-2.5">
                <button
                  type="button"
                  onClick={() => setAreasKey(a.key)}
                  className="w-full cursor-pointer rounded-pill bg-bg py-1.5 text-[10px] font-extrabold text-text-secondary"
                >
                  Set locations
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <QuickServiceAreasSheet
        open={areasKey !== null}
        onClose={() => setAreasKey(null)}
        actionKey={areasKey}
        actionLabel={activeAction?.label ?? ""}
        initialAreas={activeAction ? (settings[activeAction.key]?.areas ?? []) : []}
      />
    </div>
  );
}

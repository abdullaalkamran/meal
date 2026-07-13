"use client";

import { useEffect, useState } from "react";
import { BedDouble, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { repo, type Hostel, type User } from "@/lib/data";
import { formatBDT } from "@/lib/utils/currency";

export default function AdminHostelsPage() {
  const { toast } = useToast();
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const load = () => repo.hostels.listAll().then(setHostels);
  useEffect(() => {
    load();
    repo.users.listAll().then(setUsers);
  }, []);

  const managerName = (h: Hostel) => users.find((u) => u.id === h.managerId)?.name ?? "—";

  const toggle = async (h: Hostel) => {
    await repo.hostels.setSuspended(h.id, !h.suspended);
    toast(h.suspended ? `${h.name} reactivated` : `${h.name} suspended`);
    load();
  };

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Hostels</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">
          {hostels.filter((h) => !h.suspended).length} active · {hostels.length} total
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {hostels.map((h) => (
          <Card key={h.id} className={`flex flex-col gap-2.5 ${h.suspended ? "opacity-70" : ""}`}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-primary-soft text-primary">
                <Icon icon={BedDouble} size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="truncate text-[12.5px] font-extrabold">{h.name}</div>
                  {h.suspended && (
                    <span className="rounded-pill bg-danger-soft px-1.5 py-0.5 text-[8.5px] font-extrabold text-danger">
                      Suspended
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] font-semibold text-text-secondary">
                  <Icon icon={MapPin} size={11} /> {h.area}
                </div>
                <div className="text-[9.5px] font-semibold text-text-secondary">
                  Manager {managerName(h)} · Meal rate {formatBDT(h.mealRate)}
                </div>
              </div>
            </div>
            <button type="button" onClick={() => toggle(h)} className="self-start">
              <Chip tone={h.suspended ? "primary" : "danger"} active>
                {h.suspended ? "Reactivate" : "Suspend"}
              </Chip>
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

"use client";

import type { ServiceKind } from "@/lib/data";

const KIND_LABEL: Record<ServiceKind, string> = {
  cook: "Cooks",
  job: "Jobs",
  course: "Courses",
  offer: "Offers",
  hostel: "Hostels",
};

const ALL_KINDS: ServiceKind[] = ["cook", "job", "course", "offer", "hostel"];

/** Multi-select for which of the platform's service-catalog kinds (the same
 * ones app/service manages: cooks, jobs, courses, offers, hostels) someone is
 * responsible for. A plain checkbox list — tick any number at once. */
export function ServiceKindPicker({
  value,
  onChange,
}: {
  value: ServiceKind[];
  onChange: (next: ServiceKind[]) => void;
}) {
  const toggle = (kind: ServiceKind) => {
    onChange(value.includes(kind) ? value.filter((k) => k !== kind) : [...value, kind]);
  };

  return (
    <div>
      <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        Service types
      </div>
      {value.length === 0 && (
        <div className="mb-2 rounded-btn bg-bg px-3 py-2 text-[10px] font-semibold text-text-secondary">
          No restriction — responsible for every service type. Tick below to narrow it down.
        </div>
      )}
      <div className="flex flex-col overflow-hidden rounded-btn border border-border">
        {ALL_KINDS.map((kind, i) => (
          <label
            key={kind}
            className={`flex cursor-pointer items-center gap-2.5 px-3 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}
          >
            <input
              type="checkbox"
              checked={value.includes(kind)}
              onChange={() => toggle(kind)}
              className="h-4 w-4 shrink-0"
            />
            <span className="text-[12px] font-bold">{KIND_LABEL[kind]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

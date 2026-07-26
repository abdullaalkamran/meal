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
 * responsible for. Toggling chips — no single "select" needed. */
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
          No restriction — responsible for every service type. Select below to narrow it down.
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {ALL_KINDS.map((kind) => {
          const active = value.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              onClick={() => toggle(kind)}
              className={`rounded-pill px-3 py-1.5 text-[10.5px] font-extrabold ${
                active ? "bg-primary text-white" : "bg-bg text-text-secondary"
              }`}
            >
              {KIND_LABEL[kind]} {active ? "✓" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

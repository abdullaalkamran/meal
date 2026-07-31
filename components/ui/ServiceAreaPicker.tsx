"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { GeoArea } from "@/lib/data";
import { DIVISIONS, districtsOf } from "@/lib/geo/bangladesh";
import { Icon } from "./Icon";

/** Picks the areas where a platform service (job, offer, product, quick
 * action, …) is available — a checkbox list, not a repeated
 * pick-one-then-add flow, so selecting several regions at once is a handful
 * of taps instead of a dropdown round-trip per region. Tick a division to
 * cover it whole; expand it to tick individual districts instead. An empty
 * selection means available all over Bangladesh. */
export function ServiceAreaPicker({
  value,
  onChange,
}: {
  value: GeoArea[];
  onChange: (next: GeoArea[]) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const wholeDivision = (division: string) => value.some((a) => a.division === division && !a.district);
  const districtChecked = (division: string, district: string) =>
    value.some((a) => a.division === division && a.district === district);
  const districtsSelectedCount = (division: string) =>
    value.filter((a) => a.division === division && a.district).length;

  const toggleDivision = (division: string) => {
    if (wholeDivision(division)) {
      onChange(value.filter((a) => a.division !== division));
    } else {
      // Whole-division supersedes any individual districts already picked.
      onChange([...value.filter((a) => a.division !== division), { division }]);
    }
  };

  const toggleDistrict = (division: string, district: string) => {
    if (districtChecked(division, district)) {
      onChange(value.filter((a) => !(a.division === division && a.district === district)));
    } else {
      // Picking a specific district means "not the whole division" anymore.
      onChange([
        ...value.filter((a) => !(a.division === division && !a.district)),
        { division, district },
      ]);
    }
  };

  return (
    <div>
      <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        Available areas
      </div>
      {value.length === 0 && (
        <div className="mb-2 rounded-btn bg-bg px-3 py-2 text-[10px] font-semibold text-text-secondary">
          No area restriction — available all over Bangladesh. Tick divisions or
          districts below to limit where this shows up.
        </div>
      )}

      <div className="flex flex-col overflow-hidden rounded-btn border border-border">
        {DIVISIONS.map((division, i) => {
          const isOpen = open[division] ?? false;
          const whole = wholeDivision(division);
          const partialCount = districtsSelectedCount(division);
          return (
            <div key={division} className={i > 0 ? "border-t border-border" : ""}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [division]: !isOpen }))}
                  aria-label={isOpen ? `Collapse ${division}` : `Expand ${division}`}
                  className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center text-text-secondary"
                >
                  <Icon icon={isOpen ? ChevronDown : ChevronRight} size={15} />
                </button>
                <label className="flex flex-1 cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={whole}
                    onChange={() => toggleDivision(division)}
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="text-[12px] font-bold">{division}</span>
                  {!whole && partialCount > 0 && (
                    <span className="text-[9.5px] font-extrabold text-primary">
                      {partialCount} district{partialCount === 1 ? "" : "s"}
                    </span>
                  )}
                </label>
              </div>
              {isOpen && (
                <div className="flex flex-col gap-0.5 bg-bg px-3 py-2 pl-11">
                  {districtsOf(division).map((district) => (
                    <label key={district} className="flex cursor-pointer items-center gap-2.5 py-1">
                      <input
                        type="checkbox"
                        checked={whole || districtChecked(division, district)}
                        disabled={whole}
                        onChange={() => toggleDistrict(division, district)}
                        className="h-3.5 w-3.5 shrink-0 disabled:opacity-50"
                      />
                      <span className="text-[11px] font-semibold text-text-secondary">{district}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

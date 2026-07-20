"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { GeoArea } from "@/lib/data";
import { DIVISIONS, districtsOf, formatArea, thanasOf } from "@/lib/geo/bangladesh";
import { Icon } from "./Icon";

const selectClass =
  "w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold";

/** Picks the areas where a platform service (job, offer, product, …) is
 * available. Each added area is a division, a district, or a single thana —
 * "All districts"/"All thanas" widens the scope. An empty list means the
 * service is available all over Bangladesh. */
export function ServiceAreaPicker({
  value,
  onChange,
}: {
  value: GeoArea[];
  onChange: (next: GeoArea[]) => void;
}) {
  const [division, setDivision] = useState("");
  const [district, setDistrict] = useState("");
  const [thana, setThana] = useState("");

  const add = () => {
    if (!division) return;
    const area: GeoArea = {
      division,
      district: district || undefined,
      thana: district && thana ? thana : undefined,
    };
    const key = formatArea(area);
    if (value.some((a) => formatArea(a) === key)) return;
    // A new area swallowed by an existing wider one (or vice versa) is fine —
    // matching is per-area, duplicates are just visual noise we skip above.
    onChange([...value, area]);
    setDivision("");
    setDistrict("");
    setThana("");
  };

  return (
    <div>
      <div className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary">
        Available areas
      </div>

      {value.length === 0 ? (
        <div className="mb-2 rounded-btn bg-bg px-3 py-2 text-[10px] font-semibold text-text-secondary">
          No area restriction — available all over Bangladesh. Add areas below to
          limit where this shows up.
        </div>
      ) : (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((a) => {
            const label = formatArea(a);
            return (
              <span
                key={label}
                className="flex items-center gap-1.5 rounded-pill bg-primary-soft px-2.5 py-1.5 text-[10.5px] font-extrabold text-primary"
              >
                {label}
                <button
                  type="button"
                  aria-label={`Remove ${label}`}
                  onClick={() => onChange(value.filter((x) => formatArea(x) !== label))}
                >
                  <Icon icon={X} size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <select
          value={division}
          onChange={(e) => {
            setDivision(e.target.value);
            setDistrict("");
            setThana("");
          }}
          className={selectClass}
        >
          <option value="">Select division…</option>
          {DIVISIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        {division && (
          <div className="grid grid-cols-2 gap-2">
            <select
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                setThana("");
              }}
              className={selectClass}
            >
              <option value="">All districts</option>
              {districtsOf(division).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={thana}
              onChange={(e) => setThana(e.target.value)}
              disabled={!district}
              className={`${selectClass} disabled:opacity-50`}
            >
              <option value="">All thanas</option>
              {district &&
                thanasOf(division, district).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
            </select>
          </div>
        )}
        <button
          type="button"
          onClick={add}
          disabled={!division}
          className="min-h-9 rounded-btn bg-bg text-[11px] font-extrabold text-primary disabled:opacity-50"
        >
          + Add area
        </button>
      </div>
    </div>
  );
}

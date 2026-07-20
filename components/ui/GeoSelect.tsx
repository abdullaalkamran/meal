"use client";

import type { GeoAddress } from "@/lib/data";
import { DIVISIONS, districtsOf, thanasOf } from "@/lib/geo/bangladesh";

const selectClass =
  "w-full rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-bold";
const labelClass =
  "mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-text-secondary";

/** Cascading Bangladesh address dropdowns: division → district → thana.
 * Changing a level resets everything below it; `value` may be partial while
 * the user is still working down the levels. */
export function GeoSelect({
  value,
  onChange,
  label = "Address",
  optional,
}: {
  value: Partial<GeoAddress>;
  onChange: (next: Partial<GeoAddress>) => void;
  label?: string;
  optional?: boolean;
}) {
  const districts = value.division ? districtsOf(value.division) : [];
  const thanas = value.division && value.district ? thanasOf(value.division, value.district) : [];

  return (
    <div className="mb-3">
      <div className={labelClass}>
        {label}
        {optional && <span className="font-semibold normal-case"> · optional</span>}
      </div>
      <div className="flex flex-col gap-2">
        <select
          value={value.division ?? ""}
          onChange={(e) => onChange(e.target.value ? { division: e.target.value } : {})}
          className={selectClass}
        >
          <option value="">Select division…</option>
          {DIVISIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <select
            value={value.district ?? ""}
            onChange={(e) =>
              onChange(
                e.target.value
                  ? { division: value.division, district: e.target.value }
                  : { division: value.division }
              )
            }
            disabled={!value.division}
            className={`${selectClass} disabled:opacity-50`}
          >
            <option value="">District…</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={value.thana ?? ""}
            onChange={(e) =>
              onChange(
                e.target.value
                  ? { division: value.division, district: value.district, thana: e.target.value }
                  : { division: value.division, district: value.district }
              )
            }
            disabled={!value.district}
            className={`${selectClass} disabled:opacity-50`}
          >
            <option value="">Thana…</option>
            {thanas.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

/** True when every level of the address has been chosen. */
export function isCompleteAddress(value: Partial<GeoAddress>): value is GeoAddress {
  return !!(value.division && value.district && value.thana);
}

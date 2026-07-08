import { clsx } from "clsx";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={clsx(
        "inline-flex gap-1 rounded-pill border border-border bg-card p-1 shadow-chip",
        className
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={clsx(
            "min-h-9 cursor-pointer rounded-pill px-4 font-sans text-[11.5px] font-extrabold transition-colors",
            value === opt.value ? "bg-primary text-white" : "bg-transparent text-text"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

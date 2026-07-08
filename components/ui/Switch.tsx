import { clsx } from "clsx";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Switch({ checked, onChange, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative h-7 w-12 shrink-0 overflow-hidden rounded-pill border-none p-0 transition-colors disabled:opacity-50",
        checked ? "bg-primary" : "bg-border",
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      )}
    >
      <span
        className={clsx(
          "absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-chip transition-transform",
          checked ? "translate-x-[20px]" : "translate-x-0"
        )}
      />
    </button>
  );
}

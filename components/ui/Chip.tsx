import { clsx } from "clsx";

type Tone = "neutral" | "primary" | "blue" | "orange" | "danger";

interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  active?: boolean;
}

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "border-border text-text-secondary",
  primary: "border-primary bg-primary-soft text-primary",
  blue: "border-blue bg-blue-soft text-blue",
  orange: "border-orange bg-orange-soft text-orange",
  danger: "border-danger bg-danger-soft text-danger",
};

export function Chip({ tone = "neutral", active, className, children, ...rest }: ChipProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-pill border px-3 py-1.5 text-[11px] font-bold",
        active ? TONE_CLASSES[tone] : TONE_CLASSES.neutral,
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

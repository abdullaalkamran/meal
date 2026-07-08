import type { LucideIcon, LucideProps } from "lucide-react";

interface IconProps extends Omit<LucideProps, "ref"> {
  icon: LucideIcon;
}

/** Thin wrapper forcing the Feather-style 2px stroke used throughout the design. */
export function Icon({ icon: LucideIconComponent, size = 21, strokeWidth = 2.1, ...rest }: IconProps) {
  return <LucideIconComponent size={size} strokeWidth={strokeWidth} {...rest} />;
}

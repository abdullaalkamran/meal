import { clsx } from "clsx";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function Card({ padded = true, className, children, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-card border border-border bg-card shadow-soft",
        padded && "p-4",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

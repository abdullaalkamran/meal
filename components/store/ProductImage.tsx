"use client";

import { BookOpen, ShoppingBasket } from "lucide-react";
import { clsx } from "clsx";
import { Icon } from "@/components/ui/Icon";
import type { ProductKind } from "@/lib/data";

/** A product/book thumbnail: the uploaded photo when present, otherwise a
 * neutral per-kind icon placeholder. `className` controls size + rounding. */
export function ProductImage({
  image,
  kind,
  alt,
  className,
  iconSize = 18,
}: {
  image: string | undefined;
  kind: ProductKind;
  alt: string;
  className?: string;
  iconSize?: number;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt={alt} className={clsx("object-cover", className)} />
    );
  }
  return (
    <div className={clsx("flex items-center justify-center bg-bg text-text-secondary", className)}>
      <Icon icon={kind === "book" ? BookOpen : ShoppingBasket} size={iconSize} />
    </div>
  );
}

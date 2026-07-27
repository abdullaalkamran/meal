"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useCart } from "@/hooks/useCart";
import { Icon } from "@/components/ui/Icon";

// Pages that already show the cart inline (CartBar on the listing pages, the
// cart page itself) — the floating button would just be a redundant second
// affordance there.
const HIDE_ON = ["/explore/cart", "/explore/grocery", "/explore/books"];

/** A persistent round cart button, visible on every page of the app the
 * moment something is added to the cart — not just the store pages —
 * so the cart is never "lost track of" while browsing elsewhere. Disappears
 * the instant the cart empties (order placed, or every line removed). */
export function FloatingCartButton() {
  const { user } = useSession();
  const cart = useCart(user?.id);
  const pathname = usePathname();

  const count = cart.reduce((sum, c) => sum + c.qty, 0);
  if (count === 0 || HIDE_ON.includes(pathname)) return null;

  return (
    <Link
      href="/explore/cart"
      aria-label={`View cart, ${count} item${count === 1 ? "" : "s"}`}
      className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-soft print:hidden md:bottom-8 md:right-8"
      style={{ background: "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))" }}
    >
      <Icon icon={ShoppingCart} size={22} />
      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-extrabold text-primary">
        {count}
      </span>
    </Link>
  );
}

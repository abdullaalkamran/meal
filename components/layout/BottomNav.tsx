"use client";

import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Icon } from "@/components/ui/Icon";
import { NAV_ICONS } from "./navIcons";
import type { NavItem } from "./navItems";

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-nav-bg px-2 pb-7 pt-2 backdrop-blur-lg md:hidden">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <button
            key={item.href}
            type="button"
            onClick={() => router.push(item.href)}
            className={clsx(
              "relative flex flex-1 cursor-pointer flex-col items-center gap-0.5 py-1",
              active ? "text-primary" : "text-text-secondary"
            )}
          >
            <Icon icon={NAV_ICONS[item.iconKey]} size={21} />
            <span className="text-[9px] font-extrabold">{item.label}</span>
            {!!item.badge && (
              <span className="absolute right-[22%] top-0 flex h-4 min-w-4 items-center justify-center rounded-pill bg-danger px-1 text-[9px] font-extrabold text-white">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

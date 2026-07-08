"use client";

import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Icon } from "@/components/ui/Icon";
import { NAV_ICONS } from "./navIcons";
import type { NavItem } from "./navItems";

export function SideNav({ items, title }: { items: NavItem[]; title: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-1 border-r border-border bg-card p-4 md:flex">
      <div className="mb-4 px-2 text-[16px] font-extrabold tracking-tight">{title}</div>
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <button
            key={item.href}
            type="button"
            onClick={() => router.push(item.href)}
            className={clsx(
              "flex min-h-11 cursor-pointer items-center gap-3 rounded-btn px-3 text-[12.5px] font-bold transition-colors",
              active ? "bg-primary-soft text-primary" : "text-text-secondary hover:bg-bg"
            )}
          >
            <Icon icon={NAV_ICONS[item.iconKey]} size={19} />
            {item.label}
            {!!item.badge && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-pill bg-danger px-1.5 text-[9.5px] font-extrabold text-white">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

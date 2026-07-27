import { FloatingCartButton } from "@/components/store/FloatingCartButton";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { SideNav } from "./SideNav";
import type { NavItem } from "./navItems";

export function AppShell({
  navItems,
  title,
  children,
}: {
  navItems: NavItem[];
  title: string;
  children: React.ReactNode;
}) {
  const hasNav = navItems.length > 0;

  return (
    <div className="min-h-screen bg-bg">
      {hasNav && (
        <div className="print:hidden">
          <SideNav items={navItems} title={title} />
        </div>
      )}
      <div className={hasNav ? "md:pl-60" : undefined}>
        <div className="print:hidden">
          <AppHeader />
        </div>
        <main className={hasNav ? "px-4 pb-28 md:px-8 md:pb-10 print:p-0" : "px-4 pb-10 md:px-8 print:p-0"}>
          <div className="mx-auto w-full max-w-3xl">{children}</div>
        </main>
      </div>
      {hasNav && (
        <div className="print:hidden">
          <BottomNav items={navItems} />
        </div>
      )}
      <FloatingCartButton />
    </div>
  );
}

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
      {hasNav && <SideNav items={navItems} title={title} />}
      <div className={hasNav ? "md:pl-60" : undefined}>
        <AppHeader />
        <main className={hasNav ? "px-4 pb-28 md:px-8 md:pb-10" : "px-4 pb-10 md:px-8"}>
          <div className="mx-auto w-full max-w-3xl">{children}</div>
        </main>
      </div>
      {hasNav && <BottomNav items={navItems} />}
    </div>
  );
}

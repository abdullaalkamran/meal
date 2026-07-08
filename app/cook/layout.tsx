import { RoleGuard } from "@/components/auth/RoleGuard";
import { AppShell } from "@/components/layout/AppShell";
import { NAV_ITEMS } from "@/components/layout/navItems";

export default function CookLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="cook">
      <AppShell navItems={NAV_ITEMS.cook} title="Hostel ERP">
        {children}
      </AppShell>
    </RoleGuard>
  );
}

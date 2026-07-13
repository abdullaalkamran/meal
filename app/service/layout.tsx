import { RoleGuard } from "@/components/auth/RoleGuard";
import { AppShell } from "@/components/layout/AppShell";
import { NAV_ITEMS } from "@/components/layout/navItems";

export default function ServiceLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="service">
      <AppShell navItems={NAV_ITEMS.service} title="Service">
        {children}
      </AppShell>
    </RoleGuard>
  );
}

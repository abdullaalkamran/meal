import { RoleGuard } from "@/components/auth/RoleGuard";
import { AppShell } from "@/components/layout/AppShell";
import { NAV_ITEMS } from "@/components/layout/navItems";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="marketing">
      <AppShell navItems={NAV_ITEMS.marketing} title="Marketing">
        {children}
      </AppShell>
    </RoleGuard>
  );
}

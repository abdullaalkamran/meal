import { RoleGuard } from "@/components/auth/RoleGuard";
import { AppShell } from "@/components/layout/AppShell";
import { NAV_ITEMS } from "@/components/layout/navItems";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="owner">
      <AppShell navItems={NAV_ITEMS.owner} title="MyDorm">
        {children}
      </AppShell>
    </RoleGuard>
  );
}

import { RoleGuard } from "@/components/auth/RoleGuard";
import { AppShell } from "@/components/layout/AppShell";
import { NAV_ITEMS } from "@/components/layout/navItems";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="superadmin">
      <AppShell navItems={NAV_ITEMS.superadmin} title="Super Admin">
        {children}
      </AppShell>
    </RoleGuard>
  );
}

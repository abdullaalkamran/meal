import { RoleGuard } from "@/components/auth/RoleGuard";
import { AppShell } from "@/components/layout/AppShell";
import { NAV_ITEMS } from "@/components/layout/navItems";
import { ManageModeBanner } from "@/components/owner/ManageModeBanner";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="manager">
      <AppShell navItems={NAV_ITEMS.manager} title="Hostel ERP">
        <ManageModeBanner />
        {children}
      </AppShell>
    </RoleGuard>
  );
}

import { RoleGuard } from "@/components/auth/RoleGuard";
import { AppShell } from "@/components/layout/AppShell";
import { NAV_ITEMS } from "@/components/layout/navItems";
import { BoarderViewBanner } from "@/components/student/BoarderViewBanner";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="student">
      <AppShell navItems={NAV_ITEMS.student} title="Hostel ERP">
        <BoarderViewBanner />
        {children}
      </AppShell>
    </RoleGuard>
  );
}

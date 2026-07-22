import { RoleGuard } from "@/components/auth/RoleGuard";
import { AppShell } from "@/components/layout/AppShell";
import { NAV_ITEMS } from "@/components/layout/navItems";
import { BoarderViewBanner } from "@/components/student/BoarderViewBanner";
import { RequireHostel } from "@/components/student/RequireHostel";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard role="student">
      <AppShell navItems={NAV_ITEMS.student} title="MyDorm">
        <BoarderViewBanner />
        <RequireHostel>{children}</RequireHostel>
      </AppShell>
    </RoleGuard>
  );
}

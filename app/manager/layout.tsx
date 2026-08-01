"use client";

import { RoleGuard } from "@/components/auth/RoleGuard";
import { AppShell } from "@/components/layout/AppShell";
import { NAV_ITEMS } from "@/components/layout/navItems";
import { useSession } from "@/lib/auth/SessionProvider";
import { usePendingApprovalsCount } from "@/hooks/usePendingApprovalsCount";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const { activeHostelId } = useSession();
  const pendingCount = usePendingApprovalsCount(activeHostelId);

  const navItems = NAV_ITEMS.manager.map((item) =>
    item.href === "/manager/approvals" ? { ...item, badge: pendingCount || undefined } : item
  );

  return (
    <RoleGuard role="manager">
      <AppShell navItems={navItems} title="MyDorm">
        {children}
      </AppShell>
    </RoleGuard>
  );
}

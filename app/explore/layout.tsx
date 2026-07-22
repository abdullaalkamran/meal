import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppShell } from "@/components/layout/AppShell";

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  // Shared section for any logged-in role — no role-specific bottom/side nav
  // (AppShell renders a clean header + main when navItems is empty).
  return (
    <AuthGuard>
      <AppShell navItems={[]} title="MyDorm">
        {children}
      </AppShell>
    </AuthGuard>
  );
}

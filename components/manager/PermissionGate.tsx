"use client";

import { Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useSession } from "@/lib/auth/SessionProvider";
import { hasManagerPermission, type ManagerPermissionKey } from "@/lib/auth/permissions";

/** Renders children only when the current user may use this manager
 * capability in the active hostel. Real managers are bound by the owner's
 * per-hostel permission flags; owners (manage mode) always pass. */
export function PermissionGate({
  permission,
  label,
  children,
}: {
  permission: ManagerPermissionKey;
  label: string;
  children: React.ReactNode;
}) {
  const { user, hostel } = useSession();

  if (hasManagerPermission(user, hostel, permission)) return <>{children}</>;

  return (
    <div className="flex flex-col gap-5 pt-2">
      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg text-text-secondary">
          <Icon icon={Lock} size={24} />
        </div>
        <div className="text-[13px] font-extrabold">{label} is turned off</div>
        <div className="max-w-[260px] text-[11px] font-semibold leading-relaxed text-text-secondary">
          The hostel owner hasn&rsquo;t enabled {label.toLowerCase()} for managers. Ask them to switch
          it on in Manager permissions.
        </div>
      </Card>
    </div>
  );
}

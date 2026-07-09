"use client";

import Link from "next/link";
import {
  Bell,
  ChevronRight,
  Globe,
  Lock,
  LogOut,
  Moon,
  ShoppingCart,
  User,
  ArrowLeftRight,
} from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useRooms } from "@/hooks/useRooms";
import { useDutyPlans } from "@/hooks/useDutyPlans";
import { useTransfers } from "@/hooks/useTransfers";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { formatShortDate } from "@/lib/utils/date";

export default function StudentMorePage() {
  const { user, hostel, activeHostelId, logout } = useSession();
  const { theme, toggleTheme } = useTheme();
  const { locale, toggleLocale } = useI18n();
  const rooms = useRooms(activeHostelId);
  const plans = useDutyPlans(activeHostelId);
  const transfers = useTransfers(activeHostelId);
  const notifications = useNotifications(user?.id);
  const { toast } = useToast();

  const myRoom = rooms.find((r) => r.id === user?.roomId);
  const myPlan = plans.find((p) => p.type === "shopping" && p.memberIds.includes(user?.id ?? ""));
  const myBlock = myPlan?.blocks.find((b) => b.userIds.includes(user?.id ?? ""));
  const myTransfer = transfers.find((t) => t.userId === user?.id && t.stage !== "approved" && t.stage !== "denied");
  const unreadCount = notifications.filter((n) => !n.read).length;

  const rows: {
    label: string;
    icon: typeof User;
    tone: string;
    trailing?: string;
    href?: string;
    action?: () => void;
  }[] = [
    {
      label: "Personal information",
      icon: User,
      tone: "bg-blue-soft text-blue",
      action: () => toast("Personal information — coming in a later build phase"),
    },
    {
      label: "Shopping",
      icon: ShoppingCart,
      tone: "bg-orange-soft text-orange",
      trailing: myBlock ? formatShortDate(myBlock.dates[0]) : undefined,
      href: "/student/shopping",
    },
    {
      label: "Hostel transfer",
      icon: ArrowLeftRight,
      tone: "bg-[#7C6CF6]/10 text-[#7C6CF6]",
      trailing: myTransfer ? "Pending" : undefined,
      href: "/student/transfer",
    },
    {
      label: "Notifications",
      icon: Bell,
      tone: "bg-[#F5D742]/20 text-[#B58B00]",
      trailing: unreadCount > 0 ? String(unreadCount) : undefined,
      href: "/student/notifications",
    },
    {
      label: "ভাষা · Language",
      icon: Globe,
      tone: "bg-blue-soft text-blue",
      trailing: locale === "en" ? "English" : "বাংলা",
      action: toggleLocale,
    },
    {
      label: "Dark mode",
      icon: Moon,
      tone: "bg-[#7C6CF6]/10 text-[#7C6CF6]",
      trailing: theme === "dark" ? "On" : "Off",
      action: toggleTheme,
    },
    {
      label: "Security & biometrics",
      icon: Lock,
      tone: "bg-bg text-text-secondary",
      trailing: "On",
      action: () => toast("Security & biometrics — coming in a later build phase"),
    },
  ];

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="text-[17.5px] font-extrabold tracking-tight">Profile &amp; settings</div>

      <Card className="flex items-center gap-3">
        <Avatar name={user?.name ?? ""} seed={user?.avatarSeed} size={52} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-extrabold">{user?.name}</div>
          <div className="text-[10.5px] font-semibold text-text-secondary">
            {user?.studentId ? `ID ${user.studentId} · ${user.department}` : ""}
          </div>
          <div className="text-[10.5px] font-semibold text-text-secondary">
            {hostel?.name} · {myRoom ? `Room ${myRoom.number}` : "Unassigned"}
          </div>
        </div>
        <div className="rounded-pill bg-primary-soft px-2.5 py-1 text-[9.5px] font-extrabold text-primary">
          Active
        </div>
      </Card>

      <Card padded={false}>
        <div className="flex flex-col">
          {rows.map((row) => {
            const inner = (
              <>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${row.tone}`}>
                  <Icon icon={row.icon} size={16} />
                </div>
                <div className="min-w-0 flex-1 truncate text-[12px] font-bold">{row.label}</div>
                {row.trailing && (
                  <div className="shrink-0 text-[10.5px] font-semibold text-text-secondary">
                    {row.trailing}
                  </div>
                )}
                <Icon icon={ChevronRight} size={16} className="text-text-secondary" />
              </>
            );
            return row.href ? (
              <Link
                key={row.label}
                href={row.href}
                className="flex min-h-14 items-center gap-3 border-b border-border px-4 last:border-b-0"
              >
                {inner}
              </Link>
            ) : (
              <button
                key={row.label}
                type="button"
                onClick={row.action}
                className="flex min-h-14 cursor-pointer items-center gap-3 border-b border-border px-4 text-left last:border-b-0"
              >
                {inner}
              </button>
            );
          })}
        </div>
      </Card>

      <button
        type="button"
        onClick={logout}
        className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-btn border border-danger text-[12.5px] font-extrabold text-danger"
      >
        <Icon icon={LogOut} size={16} />
        Log out
      </button>

      <div className="text-center text-[9.5px] font-semibold text-text-secondary">
        Hostel ERP v1.0
      </div>
    </div>
  );
}

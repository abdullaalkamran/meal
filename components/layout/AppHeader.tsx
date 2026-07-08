"use client";

import { LogOut, Moon, Sun } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useSession } from "@/lib/auth/SessionProvider";

export function AppHeader() {
  const { theme, toggleTheme } = useTheme();
  const { locale, toggleLocale } = useI18n();
  const { hostel, logout } = useSession();

  return (
    <header className="flex items-center justify-between px-5 py-3 md:px-8">
      <div className="text-[11.5px] font-bold text-text-secondary">{hostel?.name ?? ""}</div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleLocale}
          className="min-h-9 cursor-pointer rounded-pill border border-border bg-card px-3 text-[10.5px] font-extrabold shadow-chip"
        >
          {locale === "en" ? "EN" : "বাং"}
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill border border-border bg-card shadow-chip"
        >
          <Icon icon={theme === "dark" ? Sun : Moon} size={16} />
        </button>
        <button
          type="button"
          onClick={logout}
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill border border-border bg-card shadow-chip"
        >
          <Icon icon={LogOut} size={16} />
        </button>
      </div>
    </header>
  );
}

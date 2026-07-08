"use client";

import { useEffect, useState } from "react";
import { repo, type Menu } from "@/lib/data";

export function useMenu(hostelId: string | undefined, date: string | undefined) {
  const [menu, setMenu] = useState<Menu | undefined>(undefined);

  useEffect(() => {
    if (!hostelId || !date) return;
    let cancelled = false;
    const load = () =>
      repo.menus.getMenu(hostelId, date).then((m) => {
        if (!cancelled) setMenu(m);
      });
    load();
    const unsub = repo.menus.subscribe(hostelId, (m) => {
      if (m.date === date) setMenu(m);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [hostelId, date]);

  return menu;
}

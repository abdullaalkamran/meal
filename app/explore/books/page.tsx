"use client";

import { useState } from "react";
import { BookOpen, Heart, Phone, Search } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useExploreInteractions } from "@/hooks/useExploreInteractions";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ExploreHeader } from "@/components/explore/ExploreHeader";
import { repo } from "@/lib/data";
import { BOOKS } from "@/lib/explore/content";
import { formatBDT } from "@/lib/utils/currency";

export default function BooksPage() {
  const { user } = useSession();
  const interactions = useExploreInteractions(user?.id);
  const { toast } = useToast();
  const [query, setQuery] = useState("");

  const saved = new Set(
    interactions.filter((i) => i.feature === "books" && i.kind === "saved").map((i) => i.itemId)
  );
  const results = BOOKS.filter((b) =>
    `${b.title} ${b.author}`.toLowerCase().includes(query.toLowerCase())
  );

  const save = async (id: string, title: string) => {
    if (!user) return;
    const was = saved.has(id);
    await repo.exploreInteractions.toggle(user.id, "books", id, "saved");
    toast(was ? "Removed from wishlist" : `Saved "${title}"`);
  };

  return (
    <div className="flex flex-col gap-5 pb-4">
      <ExploreHeader title="Buy Books" subtitle={`${saved.size} in wishlist`} />

      <div className="relative">
        <Icon icon={Search} size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title or author"
          className="w-full rounded-btn border border-border bg-transparent py-2.5 pl-9 pr-3 text-[12px] font-bold"
        />
      </div>

      <div className="flex flex-col gap-2.5">
        {results.length === 0 && (
          <Card className="text-center text-[11.5px] font-semibold text-text-secondary">No books match.</Card>
        )}
        {results.map((b) => {
          const isSaved = saved.has(b.id);
          return (
            <Card key={b.id} className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-orange-soft text-orange">
                <Icon icon={BookOpen} size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-extrabold">{b.title}</div>
                <div className="text-[10px] font-semibold text-text-secondary">{b.author}</div>
                <div className="text-[9.5px] font-semibold text-text-secondary">
                  {b.condition} · {b.seller}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <div className="text-[12.5px] font-extrabold text-primary">{formatBDT(b.price)}</div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={`tel:${b.phone}`}
                    aria-label={`Call ${b.seller}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-primary"
                  >
                    <Icon icon={Phone} size={13} />
                  </a>
                  <button type="button" onClick={() => save(b.id, b.title)} aria-label="Save book">
                    <Chip tone="primary" active={isSaved}>
                      <Icon icon={Heart} size={12} />
                    </Chip>
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

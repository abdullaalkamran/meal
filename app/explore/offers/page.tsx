"use client";

import { Copy, Tag } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useExploreInteractions } from "@/hooks/useExploreInteractions";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ExploreHeader } from "@/components/explore/ExploreHeader";
import { repo } from "@/lib/data";
import { OFFERS } from "@/lib/explore/content";

export default function OffersPage() {
  const { user } = useSession();
  const interactions = useExploreInteractions(user?.id);
  const { toast } = useToast();

  const grabbed = new Set(
    interactions.filter((i) => i.feature === "offers" && i.kind === "grabbed").map((i) => i.itemId)
  );

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast(`Code ${code} copied`);
    } catch {
      toast(`Code: ${code}`);
    }
  };

  const grab = async (id: string, shop: string) => {
    if (!user) return;
    const was = grabbed.has(id);
    await repo.exploreInteractions.toggle(user.id, "offers", id, "grabbed");
    toast(was ? "Removed" : `Saved ${shop} deal`);
  };

  return (
    <div className="flex flex-col gap-5 pb-4">
      <ExploreHeader title="Shopping offer" subtitle={`${grabbed.size} saved deals`} />

      <div className="flex flex-col gap-2.5">
        {OFFERS.map((o) => {
          const isGrabbed = grabbed.has(o.id);
          return (
            <Card key={o.id} className="flex flex-col gap-2.5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-btn bg-orange-soft text-orange">
                  <Icon icon={Tag} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-extrabold">{o.shop}</div>
                  <div className="text-[10.5px] font-semibold text-text-secondary">{o.title}</div>
                  <div className="text-[9.5px] font-semibold text-text-secondary">
                    {o.category} · Expires {o.expires}
                  </div>
                </div>
                <div className="shrink-0 rounded-pill bg-primary-soft px-2.5 py-1 text-[10px] font-extrabold text-primary">
                  {o.discount}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyCode(o.code)}
                  className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-btn border border-dashed border-border text-[11.5px] font-extrabold"
                >
                  <Icon icon={Copy} size={13} /> {o.code}
                </button>
                <button type="button" onClick={() => grab(o.id, o.shop)}>
                  <Chip tone="primary" active={isGrabbed}>
                    {isGrabbed ? "Saved ✓" : "Grab deal"}
                  </Chip>
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

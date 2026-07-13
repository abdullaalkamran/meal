"use client";

import { useEffect, useState } from "react";
import { Heart, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useCommunityPosts } from "@/hooks/useCommunityPosts";
import { repo, type Hostel } from "@/lib/data";
import { formatRelativeTime } from "@/lib/utils/date";

export default function ServiceCommunityPage() {
  const posts = useCommunityPosts();
  const { toast } = useToast();
  const [hostels, setHostels] = useState<Hostel[]>([]);

  useEffect(() => {
    repo.hostels.listAll().then(setHostels);
  }, []);

  const hostelName = (id: string) => hostels.find((h) => h.id === id)?.name ?? "Hostel";

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div>
        <div className="text-[17.5px] font-extrabold tracking-tight">Community moderation</div>
        <div className="text-[10.5px] font-semibold text-text-secondary">{posts.length} posts across all hostels</div>
      </div>

      <div className="flex flex-col gap-2.5">
        {posts.length === 0 && (
          <Card className="text-center text-[11.5px] font-semibold text-text-secondary">No posts.</Card>
        )}
        {posts.map((p) => (
          <Card key={p.id} className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              <Avatar name={p.authorName} size={34} />
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] font-extrabold">{p.authorName}</div>
                <div className="text-[9.5px] font-semibold text-text-secondary">
                  {hostelName(p.hostelId)} · {formatRelativeTime(p.createdAt)}
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await repo.community.remove(p.id);
                  toast("Post removed");
                }}
                aria-label="Remove post"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
              >
                <Icon icon={Trash2} size={14} />
              </button>
            </div>
            <div className="text-[12px] font-semibold leading-snug">{p.body}</div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-secondary">
              <Icon icon={Heart} size={12} /> {p.likeUserIds.length} likes
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Heart, Send } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useCommunityPosts } from "@/hooks/useCommunityPosts";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { ExploreHeader } from "@/components/explore/ExploreHeader";
import { repo, type Hostel } from "@/lib/data";
import { formatRelativeTime } from "@/lib/utils/date";

export default function CommunityPage() {
  const { user, activeHostelId } = useSession();
  const posts = useCommunityPosts();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const [hostels, setHostels] = useState<Hostel[]>([]);

  useEffect(() => {
    repo.hostels.listAll().then(setHostels);
  }, []);

  const hostelName = (id: string) => hostels.find((h) => h.id === id)?.name ?? "Hostel";

  const submit = async () => {
    if (!user || !body.trim()) return;
    await repo.community.post({
      hostelId: activeHostelId ?? user.hostelId,
      userId: user.id,
      authorName: user.name,
      body: body.trim(),
    });
    setBody("");
    toast("Posted to community");
  };

  const like = async (postId: string) => {
    if (!user) return;
    await repo.community.toggleLike(postId, user.id);
  };

  return (
    <div className="flex flex-col gap-5 pb-4">
      <ExploreHeader title="Hostel community" subtitle="Across all hostels" />

      <Card>
        <div className="mb-2 flex items-center gap-2.5">
          <Avatar name={user?.name ?? "You"} seed={user?.avatarSeed} photo={user?.avatarImage} size={32} />
          <div className="text-[11.5px] font-extrabold">Share with the community</div>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ask a question, sell something, share a tip…"
          className="mb-3 h-20 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!body.trim()}
          className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-btn font-extrabold text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))" }}
        >
          <Icon icon={Send} size={14} /> Post
        </button>
      </Card>

      <div className="flex flex-col gap-2.5">
        {posts.map((p) => {
          const liked = p.likeUserIds.includes(user?.id ?? "");
          return (
            <Card key={p.id} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <Avatar name={p.authorName} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] font-extrabold">{p.authorName}</div>
                  <div className="text-[9.5px] font-semibold text-text-secondary">
                    {hostelName(p.hostelId)} · {formatRelativeTime(p.createdAt)}
                  </div>
                </div>
              </div>
              <div className="text-[12px] font-semibold leading-snug">{p.body}</div>
              <button
                type="button"
                onClick={() => like(p.id)}
                className={`flex items-center gap-1.5 self-start text-[11px] font-extrabold ${
                  liked ? "text-danger" : "text-text-secondary"
                }`}
              >
                <Icon icon={Heart} size={14} className={liked ? "fill-danger" : ""} />
                {p.likeUserIds.length > 0 ? p.likeUserIds.length : ""} {liked ? "Liked" : "Like"}
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

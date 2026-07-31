"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Phone, Star } from "lucide-react";
import { useSession } from "@/lib/auth/SessionProvider";
import { useMenu } from "@/hooks/useMenu";
import { useMealDay } from "@/hooks/useMealDay";
import { useUsers } from "@/hooks/useUsers";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { StarRating } from "@/components/ui/StarRating";
import { EmojiPickerButton } from "@/components/ui/EmojiPicker";
import { MEAL_COLORS, MEAL_LABEL } from "@/lib/mealColors";
import { repo, type Comment, type MealSlot, type Reaction, type Stars, type User } from "@/lib/data";
import { addDays, today } from "@/lib/utils/date";

const SERVE_TIME: Record<MealSlot, string> = {
  breakfast: "7:30 AM",
  lunch: "1:00 PM",
  dinner: "8:00 PM",
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function useComments(hostelId: string | undefined, date: string | undefined) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});

  useEffect(() => {
    if (!hostelId || !date) return;
    let cancelled = false;
    const load = async () => {
      const list = await repo.comments.listForDate(hostelId, date);
      if (cancelled) return;
      setComments(list);
      const entries = await Promise.all(
        list.map(async (c) => [c.id, await repo.comments.listReactions(c.id)] as const)
      );
      if (!cancelled) setReactions(Object.fromEntries(entries));
    };
    load();
    const unsub = repo.comments.subscribe(hostelId, load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [hostelId, date]);

  return { comments, reactions };
}

export default function StudentMenuPage() {
  const { user, activeHostelId } = useSession();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(today());
  const menu = useMenu(activeHostelId, selectedDate);
  const { day } = useMealDay(activeHostelId, selectedDate);
  const { comments, reactions } = useComments(activeHostelId, selectedDate);
  const users = useUsers(activeHostelId);
  const [shopper, setShopper] = useState<User | undefined>(undefined);
  const [manager, setManager] = useState<User | undefined>(undefined);
  const [ratings, setRatings] = useState<{ userId: string; meal: MealSlot; target: "menu" | "cook" | "manager"; stars: number }[]>([]);
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    if (!activeHostelId || !day?.shoppingUserId) {
      queueMicrotask(() => setShopper(undefined));
      return;
    }
    repo.users.getUser(day.shoppingUserId).then(setShopper);
  }, [activeHostelId, day?.shoppingUserId]);

  useEffect(() => {
    repo.hostels.getHostel(activeHostelId ?? "").then(async (h) => {
      if (h) setManager(await repo.users.getUser(h.managerId));
    });
  }, [activeHostelId]);

  useEffect(() => {
    if (!activeHostelId || !selectedDate) return;
    let cancelled = false;
    const load = () =>
      repo.ratings.listForDate(activeHostelId, selectedDate).then((list) => {
        if (!cancelled) setRatings(list);
      });
    load();
    const unsub = repo.ratings.subscribe(activeHostelId, load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [activeHostelId, selectedDate]);

  const dayStrip = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 3));

  const myRating = (meal: MealSlot, target: "menu" | "cook" | "manager") =>
    ratings.find((r) => r.userId === user?.id && r.meal === meal && r.target === target)?.stars ?? 0;

  const setRating = (meal: MealSlot, target: "menu" | "cook" | "manager", stars: Stars) => {
    if (!activeHostelId || !user) return;
    repo.ratings.rate({ hostelId: activeHostelId, userId: user.id, date: selectedDate, meal, target, stars });
  };

  const submitComment = async () => {
    if (!activeHostelId || !user || !commentText.trim()) return;
    await repo.comments.addComment({
      hostelId: activeHostelId,
      date: selectedDate,
      userId: user.id,
      text: commentText.trim(),
    });
    setCommentText("");
  };

  // Day's food-quality average — manager ratings are about service, not food,
  // so they stay out of this number.
  const foodRatings = ratings.filter((r) => r.target !== "manager");
  const avgRating =
    foodRatings.length > 0 ? foodRatings.reduce((sum, r) => sum + r.stars, 0) / foodRatings.length : 0;

  return (
    <div className="flex flex-col gap-5 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-card"
          >
            <Icon icon={ChevronLeft} size={16} />
          </button>
          <div className="text-[16.5px] font-extrabold tracking-tight">Menu details</div>
        </div>
        {avgRating > 0 && (
          <div className="flex items-center gap-1 rounded-pill border border-border bg-card px-2.5 py-1">
            <Icon icon={Star} size={13} className="fill-orange text-orange" />
            <span className="text-[11.5px] font-extrabold">{avgRating.toFixed(1)}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {dayStrip.map((d) => {
          const dt = new Date(`${d}T00:00:00Z`);
          const isSelected = d === selectedDate;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDate(d)}
              className={`flex shrink-0 flex-col items-center gap-0.5 rounded-btn px-3.5 py-2 text-[9.5px] font-extrabold ${
                isSelected ? "bg-primary text-white" : "bg-card text-text-secondary shadow-chip"
              }`}
            >
              <span>{WEEKDAY[dt.getUTCDay()]}</span>
              <span className="text-[11.5px]">{dt.getUTCDate()}</span>
            </button>
          );
        })}
      </div>

      <Card padded={false}>
        <div className="flex flex-col divide-y divide-border">
          {(["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => {
            const c = MEAL_COLORS[meal];
            return (
              <div key={meal} className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${c.bg}`}>
                  <Icon icon={c.icon} size={18} className={c.text} />
                </div>
                <div>
                  <div className="text-[12px] font-extrabold">
                    {MEAL_LABEL[meal]} · {SERVE_TIME[meal]}
                  </div>
                  <div className="text-[10.5px] font-semibold text-text-secondary">
                    {menu?.dishes[meal]?.join(" · ") || "Menu not set yet"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">Responsible today</div>
        <div className="flex flex-col gap-2">
          {shopper && (
            <Card className="flex items-center gap-3">
              <Avatar name={shopper.name} seed={shopper.avatarSeed} photo={shopper.avatarImage} size={40} />
              <div className="min-w-0 flex-1">
                <div className="text-[9.5px] font-bold uppercase tracking-wide text-text-secondary">
                  Shopping duty
                </div>
                <div className="text-[12px] font-extrabold">{shopper.name}</div>
                <div className="text-[10px] font-semibold text-text-secondary">{shopper.phone}</div>
              </div>
              <a
                href={`tel:${shopper.phone}`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary"
              >
                <Icon icon={Phone} size={15} />
              </a>
            </Card>
          )}
          {manager && (
            <Card>
              <div className="flex items-center gap-3">
                <Avatar name={manager.name} seed={manager.avatarSeed} photo={manager.avatarImage} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="text-[9.5px] font-bold uppercase tracking-wide text-text-secondary">
                    Manager
                  </div>
                  <div className="text-[12px] font-extrabold">{manager.name}</div>
                  <div className="text-[10px] font-semibold text-text-secondary">{manager.phone}</div>
                </div>
                <a
                  href={`tel:${manager.phone}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-primary"
                >
                  <Icon icon={Phone} size={15} />
                </a>
              </div>
              {user?.role === "student" && (
                <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5">
                  <div className="text-[10.5px] font-bold text-text-secondary">Rate your manager</div>
                  <StarRating
                    value={myRating("lunch", "manager")}
                    onChange={(s) => setRating("lunch", "manager", s)}
                    size={16}
                  />
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      <Card>
        <div className="mb-0.5 text-[13.5px] font-extrabold">Rate today&rsquo;s meals</div>
        <div className="mb-3 text-[10.5px] font-semibold text-text-secondary">Food &amp; cook, per meal</div>

        <div className="mb-2 text-[9.5px] font-bold uppercase tracking-wide text-text-secondary">
          Food quality
        </div>
        <div className="mb-3 flex flex-col gap-2">
          {(["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => (
            <div key={meal} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${MEAL_COLORS[meal].dot}`} />
                <span className="text-[11px] font-bold">{MEAL_LABEL[meal]}</span>
              </div>
              <StarRating value={myRating(meal, "menu")} onChange={(s) => setRating(meal, "menu", s)} />
            </div>
          ))}
        </div>

        <div className="mb-2 border-t border-border pt-3 text-[9.5px] font-bold uppercase tracking-wide text-text-secondary">
          Cook
        </div>
        <div className="mb-4 flex flex-col gap-2">
          {(["breakfast", "lunch", "dinner"] as MealSlot[]).map((meal) => (
            <div key={meal} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${MEAL_COLORS[meal].dot}`} />
                <span className="text-[11px] font-bold">{MEAL_LABEL[meal]}</span>
              </div>
              <StarRating value={myRating(meal, "cook")} onChange={(s) => setRating(meal, "cook", s)} />
            </div>
          ))}
        </div>

        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Leave a comment about today's food…"
          className="mb-3 h-16 w-full resize-none rounded-btn border border-border bg-transparent px-3 py-2.5 text-[12px] font-semibold"
        />
        <button
          type="button"
          onClick={submitComment}
          disabled={!commentText.trim()}
          className="min-h-11 w-full cursor-pointer rounded-btn font-extrabold text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, var(--gradient-accent-from), var(--gradient-accent-to))" }}
        >
          Submit feedback
        </button>
      </Card>

      <div>
        <div className="mb-2 text-[13.5px] font-extrabold">Boarder comments</div>
        <div className="flex flex-col gap-2.5">
          {comments.length === 0 && (
            <Card className="text-[11.5px] font-semibold text-text-secondary">No comments yet.</Card>
          )}
          {comments.map((c) => {
            const author = users.find((u) => u.id === c.userId);
            const commentReactions = reactions[c.id] ?? [];
            const grouped = commentReactions.reduce<Record<string, number>>((acc, r) => {
              acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
              return acc;
            }, {});
            const time = new Date(c.createdAt);
            return (
              <Card key={c.id}>
                <div className="mb-1.5 flex items-center gap-2.5">
                  <Avatar name={author?.name ?? "?"} seed={author?.avatarSeed} photo={author?.avatarImage} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11.5px] font-extrabold">{author?.name ?? "Member"}</div>
                    <div className="text-[9.5px] font-semibold text-text-secondary">
                      {WEEKDAY[time.getDay()]}, {time.getHours() % 12 || 12}:
                      {String(time.getMinutes()).padStart(2, "0")}{" "}
                      {time.getHours() >= 12 ? "PM" : "AM"}
                    </div>
                  </div>
                </div>
                <div className="mb-2 text-[11.5px] font-semibold">{c.text}</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {Object.entries(grouped).map(([emoji, count]) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => user && repo.comments.toggleReaction(c.id, user.id, emoji)}
                      className="flex items-center gap-1 rounded-pill border border-border bg-bg px-2 py-0.5 text-[10.5px] font-bold"
                    >
                      <span>{emoji}</span>
                      <span>{count}</span>
                    </button>
                  ))}
                  <EmojiPickerButton
                    onSelect={(emoji) => user && repo.comments.toggleReaction(c.id, user.id, emoji)}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

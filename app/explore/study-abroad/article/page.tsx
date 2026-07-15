"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useStudyAbroadItems } from "@/hooks/useStudyAbroad";
import type { StudyAbroadItem } from "@/lib/data";

function Article() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  const all = useStudyAbroadItems();

  const blog = all.find(
    (i): i is Extract<StudyAbroadItem, { kind: "blog" }> => i.kind === "blog" && i.id === id
  );

  if (!blog) {
    return (
      <div className="flex flex-col gap-5 pb-4 pt-2">
        <Card className="text-center text-[11.5px] font-semibold text-text-secondary">
          Loading article…
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-bg"
        >
          <Icon icon={ChevronLeft} size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-extrabold tracking-tight">Study abroad article</div>
          <div className="text-[10px] font-semibold text-text-secondary">{blog.country}</div>
        </div>
      </div>

      {blog.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={blog.image} alt={blog.title} className="h-40 w-full rounded-card object-cover" />
      )}

      <div>
        <h1 className="text-[17px] font-extrabold leading-snug tracking-tight">{blog.title}</h1>
        <div className="mt-1 text-[10.5px] font-semibold text-text-secondary">by {blog.author}</div>
      </div>

      <div className="flex flex-col gap-3">
        {blog.body.split(/\n\s*\n/).map((para, idx) => (
          <p key={idx} className="text-[12px] font-semibold leading-relaxed text-text">
            {para}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function ArticlePage() {
  // useSearchParams requires a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <Article />
    </Suspense>
  );
}

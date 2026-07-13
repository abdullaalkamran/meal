"use client";

import { useEffect, useState } from "react";
import { repo, type CommunityPost } from "@/lib/data";

export function useCommunityPosts() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);

  useEffect(() => {
    return repo.community.subscribe(setPosts);
  }, []);

  return posts;
}

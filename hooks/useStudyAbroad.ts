"use client";

import { useEffect, useState } from "react";
import { repo, type StudyAbroadItem } from "@/lib/data";

/** Every study-abroad hub item (countries, scholarships, counsellors, promos)
 * — pages filter by kind/active. */
export function useStudyAbroadItems(): StudyAbroadItem[] {
  const [items, setItems] = useState<StudyAbroadItem[]>([]);
  useEffect(() => repo.studyAbroad.subscribe(setItems), []);
  return items;
}

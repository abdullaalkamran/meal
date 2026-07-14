"use client";

import { useEffect, useState } from "react";
import { repo, type UsedBookListing } from "@/lib/data";

/** All member-listed old books across the platform, newest first. */
export function useUsedBooks(): UsedBookListing[] {
  const [books, setBooks] = useState<UsedBookListing[]>([]);
  useEffect(() => repo.usedBooks.subscribe(setBooks), []);
  return books;
}

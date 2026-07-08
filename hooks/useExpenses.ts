"use client";

import { useEffect, useState } from "react";
import { repo, type Expense } from "@/lib/data";

export function useExpenses(hostelId: string | undefined) {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    if (!hostelId) return;
    return repo.expenses.subscribe(hostelId, setExpenses);
  }, [hostelId]);

  return expenses;
}

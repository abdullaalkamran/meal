"use client";

import { useEffect, useState } from "react";
import { repo, type User } from "@/lib/data";

export function useUsers(hostelId: string | undefined) {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!hostelId) return;
    return repo.users.subscribe(hostelId, setUsers);
  }, [hostelId]);

  return users;
}

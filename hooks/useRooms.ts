"use client";

import { useEffect, useState } from "react";
import { repo, type Room } from "@/lib/data";

export function useRooms(hostelId: string | undefined) {
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    if (!hostelId) return;
    return repo.rooms.subscribe(hostelId, setRooms);
  }, [hostelId]);

  return rooms;
}

"use client";

import { useEffect, useState } from "react";
import { repo, type Payment, type ShoppingCost } from "@/lib/data";
import { useMealStops } from "./useMealStops";
import { useGuestMeals } from "./useGuestMeals";
import { useCookLeaveRequests } from "./useCookLeaveRequests";
import { useTransfers } from "./useTransfers";
import { useJoinRequests } from "./useJoinRequests";
import { useLeaveRequests } from "./useLeaveRequests";
import { currentMonth } from "@/lib/utils/date";

/** Total pending items across every manager-approval category — the same
 * eight categories the Approvals page counts — so the nav badge and any
 * other summary never drift from what "Approvals" actually shows. */
export function usePendingApprovalsCount(hostelId: string | undefined): number {
  const mealStops = useMealStops(hostelId).filter((r) => r.status === "pending").length;
  const guestMeals = useGuestMeals(hostelId).filter((r) => r.status === "pending").length;
  const cookLeave = useCookLeaveRequests(hostelId).filter((r) => r.status === "pending").length;
  const transfersOut = useTransfers(hostelId).filter(
    (t) => t.fromHostelId === hostelId && t.stage === "requested"
  ).length;
  const joinRequests = useJoinRequests(hostelId).filter((r) => r.status === "pending").length;
  const leaveRequests = useLeaveRequests(hostelId).filter((r) => r.status === "pending").length;

  const [payments, setPayments] = useState<Payment[]>([]);
  const [shoppingCosts, setShoppingCosts] = useState<ShoppingCost[]>([]);

  useEffect(() => {
    if (!hostelId) return;
    repo.bills.listPendingVerification(hostelId, currentMonth()).then(setPayments);
  }, [hostelId]);

  useEffect(() => {
    if (!hostelId) return;
    repo.shoppingCosts.listByHostel(hostelId).then(setShoppingCosts);
  }, [hostelId]);

  const pendingShoppingCosts = shoppingCosts.filter((c) => c.status === "pending").length;

  return (
    mealStops +
    guestMeals +
    cookLeave +
    transfersOut +
    joinRequests +
    leaveRequests +
    payments.length +
    pendingShoppingCosts
  );
}

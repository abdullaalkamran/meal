// The starting state for the JSON fallback store.
//
// Deliberately EMPTY. The demo dataset (two sample hostels, sample members,
// meals, bills, jobs/courses/offers/products…) and the hardcoded platform-team
// accounts were removed: on a live deployment they were both misleading data
// and, because sign-in is phone-only, a set of admin phone numbers published
// in a public repo.
//
// Real deployments run on MySQL, where the platform admin is created from the
// SUPERADMIN_PHONE / SUPERADMIN_NAME environment variables on first start
// (lib/data/server/mysql/bootstrap.ts). Without MySQL configured, the app
// starts with nothing and the first person signs up as a hostel owner.

import type { Tables } from "./store";

export function buildSeed(): Tables {
  return {
    users: [],
    activityLogs: [],
    rooms: [],
    hostels: [],
    mealDays: [],
    menus: [],
    ratings: [],
    comments: [],
    reactions: [],
    dutyPlans: [],
    swapRequests: [],
    shoppingCosts: [],
    shoppingCostEditRequests: [],
    shoppingCostEditVotes: [],
    shortageRequests: [],
    bills: [],
    payments: [],
    billAdjustments: [],
    cookLeaveRequests: [],
    cookAttendanceReports: [],
    cookAttendanceVotes: [],
    mealEditRequests: [],
    mealEditVotes: [],
    announcements: [],
    notifications: [],
    pushSubscriptions: [],
    promotions: [],
    expenses: [],
    transferRequests: [],
    joinRequests: [],
    leaveRequests: [],
    mealStopRequests: [],
    guestMealRequests: [],
    exploreInteractions: [],
    communityPosts: [],
    serviceListings: [],
    campaigns: [],
    marketingTargets: [],
    products: [],
    cartItems: [],
    orders: [],
    storeSettings: { deliveryFeeEnabled: true, deliveryFee: 30 },
    coupons: [],
    usedBookListings: [],
    studyAbroadItems: [],
    studyLeads: [],
    passwordHashes: {},
    passwordResetOtps: [],
    smtpSettings: null,
    heroPromoSettings: {
      sources: { study: true, offers: true, grocery: true, books: true },
      intervalSec: 4,
      photoHeightPx: 150,
    },
    quickServiceSettings: {},
    announcementDismissals: {},
  };
}

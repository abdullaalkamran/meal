import type {
  Announcement,
  Bill,
  Campaign,
  CommunityPost,
  CookAttendanceReport,
  CookAttendanceVote,
  CookLeaveRequest,
  DutyPlan,
  Expense,
  GuestMealRequest,
  Hostel,
  HostelTransferRequest,
  JoinRequest,
  MealDay,
  MealStopRequest,
  Menu,
  Notification,
  MarketingTarget,
  Payment,
  Product,
  Rating,
  Room,
  ServiceListing,
  ShoppingCost,
  UsedBookListing,
  User,
} from "../types";
import type { Tables } from "./store";
import { addDays, currentMonth, today } from "../../utils/date";
import {
  BOOKS,
  COOKS,
  COURSES,
  EXTRA_HOSTELS,
  GROCERY_SEED,
  JOBS,
  NEW_BOOKS_SEED,
  OFFERS,
  STUDY_ABROAD,
} from "../../explore/content";

const T = today();

export function buildSeed(): Tables {
  const hostels: Hostel[] = [
    {
      id: "hostel_bright",
      name: "Bright Hostel",
      area: "Mirpur, Dhaka",
      ownerId: "u_owner",
      managerId: "u_manager_bright",
      cookId: "u_cook_bright",
      mealRate: 95,
      kitchenLocation: "Room 101 · GF",
      cookMonthlySalary: 12000,
      settings: {
        mealCutoff: [
          { meal: "breakfast", time: "21:00" },
          { meal: "lunch", time: "09:00" },
          { meal: "dinner", time: "15:00" },
        ],
        guestMealPrice: 80,
        mealStopRequiresApproval: true,
        shoppingRotationPolicy: "spin-wheel",
      },
    },
    {
      id: "hostel_green",
      name: "Green View",
      area: "Dhanmondi, Dhaka",
      ownerId: "u_owner",
      managerId: "u_manager_green",
      cookId: "u_cook_green",
      mealRate: 102,
      kitchenLocation: "Room G3 · GF",
      cookMonthlySalary: 11500,
      settings: {
        mealCutoff: [
          { meal: "breakfast", time: "21:00" },
          { meal: "lunch", time: "09:00" },
          { meal: "dinner", time: "15:00" },
        ],
        guestMealPrice: 80,
        mealStopRequiresApproval: true,
        shoppingRotationPolicy: "spin-wheel",
      },
    },
  ];

  const users: User[] = [
    {
      id: "u_owner",
      hostelId: "hostel_bright",
      name: "Abdullah Karim",
      phone: "01711-000001",
      role: "owner",
      avatarSeed: "owner-abdullah",
      ownedHostelIds: ["hostel_bright", "hostel_green"],
    },
    // Platform team (our SaaS staff, above the hostels). hostelId is a nominal
    // fallback — these roles operate cross-platform, not within one hostel.
    {
      id: "u_superadmin",
      hostelId: "hostel_bright",
      name: "Shahin Alam",
      phone: "01700-000010",
      role: "superadmin",
      avatarSeed: "admin-shahin",
    },
    {
      id: "u_marketing",
      hostelId: "hostel_bright",
      name: "Farhana Haque",
      phone: "01700-000011",
      role: "marketing",
      avatarSeed: "marketing-farhana",
    },
    {
      id: "u_service",
      hostelId: "hostel_bright",
      name: "Imran Hossain",
      phone: "01700-000012",
      role: "service",
      avatarSeed: "service-imran",
    },
    {
      id: "u_manager_bright",
      hostelId: "hostel_bright",
      name: "Rashed Karim",
      phone: "01711-000002",
      role: "manager",
      roomId: "room_bright_202",
      avatarSeed: "manager-rashed",
    },
    {
      id: "u_manager_green",
      hostelId: "hostel_green",
      name: "Nusrat Jahan",
      phone: "01711-000003",
      role: "manager",
      roomId: "room_green_g2",
      avatarSeed: "manager-nusrat",
    },
    {
      id: "u_cook_bright",
      hostelId: "hostel_bright",
      name: "Jashim Uddin",
      phone: "01711-000004",
      role: "cook",
      avatarSeed: "cook-jashim",
    },
    {
      id: "u_cook_green",
      hostelId: "hostel_green",
      name: "Salma Begum",
      phone: "01711-000005",
      role: "cook",
      avatarSeed: "cook-salma",
    },
    {
      id: "u_student_1",
      hostelId: "hostel_bright",
      name: "Karim Rahman",
      phone: "01711-000006",
      role: "student",
      roomId: "room_bright_101",
      avatarSeed: "student-karim",
      studentId: "STU2024005",
      department: "CSE, BUET",
      joinedAt: "2024-01-15",
      managerRating: 5,
      managerRatingNote: "Pays on time, keeps the room tidy.",
    },
    {
      id: "u_student_2",
      hostelId: "hostel_bright",
      name: "Fahim Chowdhury",
      phone: "01711-000007",
      role: "student",
      roomId: "room_bright_101",
      avatarSeed: "student-fahim",
      studentId: "STU2024012",
      department: "EEE, BUET",
      joinedAt: "2024-03-02",
      managerRating: 4,
    },
    {
      id: "u_student_3",
      hostelId: "hostel_bright",
      name: "Tanvir Ahmed",
      phone: "01711-000008",
      role: "student",
      roomId: "room_bright_103",
      avatarSeed: "student-tanvir",
      studentId: "STU2024019",
      department: "ME, BUET",
      joinedAt: "2023-11-20",
    },
    {
      id: "u_student_4",
      hostelId: "hostel_green",
      name: "Nabila Islam",
      phone: "01711-000009",
      role: "student",
      roomId: "room_green_g1",
      avatarSeed: "student-nabila",
      studentId: "STU2024027",
      department: "Architecture, BUET",
    },
  ];

  const rooms: Room[] = [
    {
      id: "room_bright_101",
      hostelId: "hostel_bright",
      number: "101",
      capacity: 3,
      occupantIds: ["u_student_1", "u_student_2"],
      seatRent: 1800,
      facilities: ["Attached bath", "Balcony", "Ceiling fan"],
    },
    {
      id: "room_bright_103",
      hostelId: "hostel_bright",
      number: "103",
      capacity: 2,
      occupantIds: ["u_student_3"],
      seatRent: 2200,
      facilities: ["Attached bath", "AC"],
    },
    {
      id: "room_bright_104",
      hostelId: "hostel_bright",
      number: "104",
      capacity: 2,
      occupantIds: [],
      seatRent: 2200,
    },
    {
      id: "room_bright_202",
      hostelId: "hostel_bright",
      number: "202",
      capacity: 1,
      occupantIds: ["u_manager_bright"],
      seatRent: 3500,
      facilities: ["Attached bath", "AC", "Balcony", "Study desk"],
    },
    {
      id: "room_green_g1",
      hostelId: "hostel_green",
      number: "G1",
      capacity: 2,
      occupantIds: ["u_student_4"],
      seatRent: 2000,
    },
    {
      id: "room_green_g2",
      hostelId: "hostel_green",
      number: "G2",
      capacity: 1,
      occupantIds: ["u_manager_green"],
      seatRent: 3200,
    },
  ];

  const brightBoarders = ["u_manager_bright", "u_student_1", "u_student_2", "u_student_3"];

  const mealDays: MealDay[] = [
    {
      hostelId: "hostel_bright",
      date: T,
      shoppingUserId: "u_student_1",
      entries: Object.fromEntries(
        brightBoarders.map((id, i) => [
          id,
          {
            breakfast: { on: i !== 2, guestCount: 0 },
            lunch: { on: true, guestCount: id === "u_student_2" ? 2 : 0 },
            dinner: { on: true, guestCount: 0 },
          },
        ])
      ),
    },
    // Past few days — matched to the Recent Shopping history below, so the
    // shopping-responsible rate/leaderboard has real meal counts to divide by.
    {
      hostelId: "hostel_bright",
      date: addDays(T, -3),
      shoppingUserId: "u_student_3",
      entries: Object.fromEntries(
        brightBoarders.map((id, i) => [
          id,
          {
            breakfast: { on: i !== 0, guestCount: 0 },
            lunch: { on: true, guestCount: 0 },
            dinner: { on: i !== 1, guestCount: id === "u_student_3" ? 1 : 0 },
          },
        ])
      ),
    },
    {
      hostelId: "hostel_bright",
      date: addDays(T, -4),
      shoppingUserId: "u_student_2",
      entries: Object.fromEntries(
        brightBoarders.map((id, i) => [
          id,
          {
            breakfast: { on: i !== 0 && i !== 3, guestCount: 0 },
            lunch: { on: i !== 3, guestCount: 0 },
            dinner: { on: true, guestCount: 0 },
          },
        ])
      ),
    },
    {
      hostelId: "hostel_bright",
      date: addDays(T, -5),
      shoppingUserId: "u_student_1",
      entries: Object.fromEntries(
        brightBoarders.map((id) => [
          id,
          {
            breakfast: { on: true, guestCount: 0 },
            lunch: { on: true, guestCount: 0 },
            dinner: { on: true, guestCount: 0 },
          },
        ])
      ),
    },
  ];

  const menus: Menu[] = [
    {
      hostelId: "hostel_bright",
      date: T,
      dishes: {
        breakfast: ["Paratha", "Egg curry", "Tea"],
        lunch: ["Rice", "Rui fish curry", "Lentil soup", "Salad"],
        dinner: ["Rice", "Chicken curry", "Mixed vegetables"],
      },
    },
  ];

  // Food-quality ratings for the same past days as the Recent Shopping
  // history — lets the shopping leaderboard rank real cost-vs-quality data.
  const ratings: Rating[] = [
    { id: "rating_1", hostelId: "hostel_bright", userId: "u_student_1", date: addDays(T, -3), meal: "lunch", target: "menu", stars: 5 },
    { id: "rating_2", hostelId: "hostel_bright", userId: "u_student_2", date: addDays(T, -3), meal: "dinner", target: "menu", stars: 4 },
    { id: "rating_3", hostelId: "hostel_bright", userId: "u_manager_bright", date: addDays(T, -3), meal: "breakfast", target: "menu", stars: 5 },
    { id: "rating_4", hostelId: "hostel_bright", userId: "u_student_1", date: addDays(T, -4), meal: "lunch", target: "menu", stars: 3 },
    { id: "rating_5", hostelId: "hostel_bright", userId: "u_student_3", date: addDays(T, -4), meal: "dinner", target: "menu", stars: 3 },
    { id: "rating_6", hostelId: "hostel_bright", userId: "u_manager_bright", date: addDays(T, -4), meal: "breakfast", target: "menu", stars: 4 },
    { id: "rating_7", hostelId: "hostel_bright", userId: "u_student_2", date: addDays(T, -5), meal: "lunch", target: "menu", stars: 4 },
    { id: "rating_8", hostelId: "hostel_bright", userId: "u_student_3", date: addDays(T, -5), meal: "dinner", target: "menu", stars: 4 },
    { id: "rating_9", hostelId: "hostel_bright", userId: "u_manager_bright", date: addDays(T, -5), meal: "breakfast", target: "menu", stars: 4 },
  ];

  const dutyPlans: DutyPlan[] = [
    {
      id: "duty_shop_1",
      hostelId: "hostel_bright",
      type: "shopping",
      requiresSpin: true,
      startDate: T,
      endDate: addDays(T, 8),
      memberIds: ["u_student_1", "u_student_2", "u_student_3"],
      blocks: [
        {
          userIds: ["u_student_1", "u_student_2"],
          dates: [T, addDays(T, 1), addDays(T, 2), addDays(T, 3)],
        },
        {
          userIds: ["u_student_3"],
          dates: [addDays(T, 4), addDays(T, 5), addDays(T, 6), addDays(T, 7)],
        },
      ],
      spun: { u_student_1: true, u_student_2: true, u_student_3: false },
      budgetPerDay: 2500,
      createdAt: T,
    },
  ];

  const shoppingCosts: ShoppingCost[] = [
    {
      id: "shopcost_1",
      hostelId: "hostel_bright",
      userId: "u_student_3",
      dates: [addDays(T, -3)],
      amount: 2450,
      items: "12",
      createdAt: addDays(T, -3),
    },
    {
      id: "shopcost_2",
      hostelId: "hostel_bright",
      userId: "u_student_2",
      dates: [addDays(T, -4)],
      amount: 1830,
      items: "8",
      createdAt: addDays(T, -4),
    },
    {
      id: "shopcost_3",
      hostelId: "hostel_bright",
      userId: "u_student_1",
      dates: [addDays(T, -5)],
      amount: 3120,
      items: "15",
      createdAt: addDays(T, -5),
    },
  ];

  const swapRequests = [
    {
      id: "swap_1",
      hostelId: "hostel_bright",
      planId: "duty_shop_1",
      fromUserId: "u_student_1",
      toUserId: "u_student_3",
      status: "pending" as const,
      createdAt: T,
    },
  ];

  const cookAttendanceReports: CookAttendanceReport[] = [
    {
      id: "cookattend_1",
      hostelId: "hostel_bright",
      date: T,
      meal: "lunch",
      status: "reported",
      reportedBy: "u_manager_bright",
      createdAt: T,
    },
  ];

  const cookAttendanceVotes: CookAttendanceVote[] = [
    { reportId: "cookattend_1", userId: "u_student_1", choice: "yes", votedAt: T },
    { reportId: "cookattend_1", userId: "u_student_3", choice: "no", votedAt: T },
  ];

  const cookLeaveRequests: CookLeaveRequest[] = [
    {
      id: "cookleave_1",
      hostelId: "hostel_bright",
      cookId: "u_cook_bright",
      dateFrom: addDays(T, 5),
      dateTo: addDays(T, 6),
      scope: "partial",
      meals: ["lunch", "dinner"],
      reason: "Family emergency in the village",
      status: "pending",
      createdAt: T,
    },
    {
      id: "cookleave_2",
      hostelId: "hostel_bright",
      cookId: "u_cook_bright",
      dateFrom: addDays(T, -10),
      dateTo: addDays(T, -9),
      scope: "full-day",
      reason: "Fever, saw a doctor",
      status: "approved",
      decidedBy: "u_manager_bright",
      decidedAt: addDays(T, -10),
      createdAt: addDays(T, -11),
    },
    {
      id: "cookleave_3",
      hostelId: "hostel_bright",
      cookId: "u_cook_bright",
      dateFrom: addDays(T, -20),
      dateTo: addDays(T, -20),
      scope: "full-day",
      reason: "Eid preparation at home",
      status: "approved",
      decidedBy: "u_manager_bright",
      decidedAt: addDays(T, -20),
      createdAt: addDays(T, -21),
    },
  ];

  const announcements: Announcement[] = [
    {
      id: "ann_1",
      hostelId: "hostel_bright",
      kind: "cook-absence-poll",
      title: "Was lunch cooked today?",
      body: "The cook hasn't confirmed lunch today. Please vote so the manager can decide.",
      payload: { reportId: "cookattend_1", meal: "lunch", date: T },
      createdAt: new Date(Date.now() - 25 * 60_000).toISOString(),
    },
    {
      id: "ann_2",
      hostelId: "hostel_bright",
      kind: "spin-wheel-cta",
      title: "Spin the wheel — shopping duty",
      body: "A new shopping duty rotation is ready. Spin to reveal your dates.",
      payload: { planId: "duty_shop_1" },
      createdAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
    },
    {
      id: "ann_3",
      hostelId: "hostel_bright",
      kind: "swap-request",
      title: "Shopping duty swap requested",
      body: "Fahim Chowdhury wants to swap shopping duty dates with you.",
      payload: { swapId: "swap_1" },
      createdAt: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
    },
  ];

  const notifications: Notification[] = [
    {
      id: "notif_1",
      userId: "u_student_1",
      announcementId: "ann_2",
      title: "Spin the wheel — shopping duty",
      body: "Your shopping duty rotation is ready.",
      read: false,
      createdAt: T,
    },
    {
      id: "notif_2",
      userId: "u_student_1",
      title: "Bill generated",
      body: `Your ${currentMonth()} bill is ready.`,
      read: false,
      createdAt: T,
    },
  ];

  const expenses: Expense[] = [
    {
      id: "exp_1",
      hostelId: "hostel_bright",
      category: "Grocery",
      amount: 18500,
      dateFrom: T,
      dateTo: T,
      note: "Weekly market run",
      memberIds: brightBoarders,
      splitMode: "equal",
      billingMonth: currentMonth(),
    },
    {
      id: "exp_2",
      hostelId: "hostel_bright",
      category: "Utilities",
      amount: 4200,
      dateFrom: T,
      dateTo: T,
      note: "Electricity bill",
      memberIds: brightBoarders,
      splitMode: "equal",
      billingMonth: currentMonth(),
    },
    {
      id: "exp_3",
      hostelId: "hostel_bright",
      category: "Salary",
      amount: 7000,
      dateFrom: T,
      dateTo: T,
      note: "Cook salary — partial advance",
      memberIds: brightBoarders,
      splitMode: "equal",
      billingMonth: currentMonth(),
    },
  ];

  const bills: Bill[] = [
    {
      id: "bill_1",
      hostelId: "hostel_bright",
      userId: "u_student_1",
      month: currentMonth(),
      mealsCount: 58,
      sections: [
        {
          label: "mealCost",
          items: [{ label: "Meals eaten (58)", amount: 5510 }],
          total: 5510,
          paid: 5510,
        },
        {
          label: "serviceCharge",
          items: [
            { label: "Electricity share", amount: 220 },
            { label: "Wifi share", amount: 150 },
            { label: "Cook salary share", amount: 380 },
          ],
          total: 750,
          paid: 750,
        },
        {
          label: "roomRent",
          items: [{ label: "Room 101 share", amount: 3500 }],
          total: 3500,
          paid: 740,
        },
      ],
      previousBalance: 0,
      previousBalancePaid: 0,
      grandTotal: 9760,
      paid: 7000,
    },
  ];

  const payments: Payment[] = [
    {
      id: "pay_1",
      billId: "bill_1",
      amount: 7000,
      paidAt: addDays(T, -5),
      method: "bKash",
      reference: "TXN 9F2KA",
      verified: true,
      targets: ["mealCost", "roomRent", "serviceCharge", "cookSalary"],
      breakdown: { mealCost: 5510, serviceCharge: 750, roomRent: 740 },
    },
  ];

  const joinRequests: JoinRequest[] = [
    {
      id: "join_1",
      hostelId: "hostel_bright",
      name: "Sabbir Hossain",
      phone: "01711-000099",
      status: "pending",
      createdAt: T,
    },
  ];

  const transferRequests: HostelTransferRequest[] = [
    {
      id: "transfer_1",
      userId: "u_student_4",
      fromHostelId: "hostel_green",
      toHostelId: "hostel_bright",
      reason: "Closer to campus",
      stage: "manager_review",
      timeline: [{ stage: "requested", at: addDays(T, -2) }],
    },
  ];

  const mealStopRequests: MealStopRequest[] = [
    {
      id: "stop_1",
      hostelId: "hostel_bright",
      userId: "u_student_3",
      meals: ["lunch", "dinner"],
      dateFrom: addDays(T, 2),
      dateTo: addDays(T, 4),
      reason: "Going home for the weekend",
      status: "pending",
    },
  ];

  const guestMealRequests: GuestMealRequest[] = [
    {
      id: "guest_1",
      hostelId: "hostel_bright",
      userId: "u_student_2",
      meal: "lunch",
      date: T,
      guestName: "Rafiq (cousin)",
      qty: 2,
      status: "pending",
    },
  ];

  const communityPosts: CommunityPost[] = [
    {
      id: "cpost_1",
      hostelId: "hostel_bright",
      userId: "u_student_1",
      authorName: "Karim Rahman",
      body: "Anyone from Bright Hostel heading to campus around 8am? Can share a rickshaw.",
      createdAt: addDays(T, -1),
      likeUserIds: ["u_student_2", "u_student_3"],
    },
    {
      id: "cpost_2",
      hostelId: "hostel_green",
      userId: "u_student_4",
      authorName: "Nabila Islam",
      body: "Selling my second-year textbooks at half price — DM if interested!",
      createdAt: addDays(T, -2),
      likeUserIds: ["u_student_1"],
    },
    {
      id: "cpost_3",
      hostelId: "hostel_bright",
      userId: "u_manager_bright",
      authorName: "Rashed Karim",
      body: "Reminder: water tank cleaning this Friday morning. Store drinking water tonight.",
      createdAt: addDays(T, -3),
      likeUserIds: ["u_student_1", "u_student_2", "u_student_3"],
    },
  ];

  // Service catalog — seeded from the static /explore content, now the live,
  // Service-Manager-editable source of truth for those pages.
  const serviceListings: ServiceListing[] = [
    ...COOKS.map((c) => ({ kind: "cook" as const, id: c.id, active: true, createdAt: T, name: c.name, cuisine: c.cuisine, experienceYears: c.experienceYears, monthlyRate: c.monthlyRate, rating: c.rating, phone: c.phone })),
    ...JOBS.map((j) => ({ kind: "job" as const, id: j.id, active: true, createdAt: T, title: j.title, company: j.company, location: j.location, jobType: j.type, pay: j.pay, tags: j.tags })),
    ...COURSES.map((c) => ({ kind: "course" as const, id: c.id, active: true, createdAt: T, title: c.title, provider: c.provider, category: c.category, level: c.level, duration: c.duration, price: c.price })),
    ...OFFERS.map((o) => ({ kind: "offer" as const, id: o.id, active: true, createdAt: T, shop: o.shop, title: o.title, discount: o.discount, code: o.code, expires: o.expires, category: o.category })),
    ...EXTRA_HOSTELS.map((h) => ({ kind: "hostel" as const, id: h.id, active: true, createdAt: T, name: h.name, area: h.area, seatRentFrom: h.seatRentFrom, seatsAvailable: h.seatsAvailable, rating: h.rating, amenities: h.amenities, phone: h.phone })),
    ...STUDY_ABROAD.map((s) => ({ kind: "studyabroad" as const, id: s.id, active: true, createdAt: T, agency: s.agency, country: s.country, services: s.services, intake: s.intake, consultationFee: s.consultationFee, rating: s.rating, phone: s.phone })),
  ];

  const campaigns: Campaign[] = [
    { id: "camp_1", name: "Back-to-campus signup drive", channel: "Facebook + Instagram", status: "running", startDate: addDays(T, -10), budget: 25000, note: "Targeting new session students." },
    { id: "camp_2", name: "Refer-a-roommate bonus", channel: "In-app + SMS", status: "planned", startDate: addDays(T, 5), budget: 12000 },
    { id: "camp_3", name: "Ramadan meal-plan promo", channel: "Email", status: "done", startDate: addDays(T, -45), budget: 8000, note: "Wrapped up, 4 hostels onboarded." },
  ];

  const marketingTargets: MarketingTarget[] = [
    { metric: "users", month: currentMonth(), target: 12 },
    { metric: "signups", month: currentMonth(), target: 6 },
    { metric: "revenue", month: currentMonth(), target: 20000 },
  ];

  // Platform store inventory — grocery + NEW books, stocked by the Service Manager.
  const products: Product[] = [
    ...GROCERY_SEED.map((g) => ({ kind: "grocery" as const, id: g.id, active: true, createdAt: T, name: g.name, price: g.price, category: g.category, unit: g.unit })),
    ...NEW_BOOKS_SEED.map((b) => ({ kind: "book" as const, id: b.id, active: true, createdAt: T, name: b.name, price: b.price, category: b.category, author: b.author, academicClass: b.academicClass })),
  ];

  // OLD books — member-listed, seeded from the existing static BOOKS list.
  const usedBookSellers: Record<string, { sellerId: string; hostelId: string }> = {
    bk_1: { sellerId: "u_student_3", hostelId: "hostel_bright" },
    bk_2: { sellerId: "u_student_2", hostelId: "hostel_bright" },
    bk_3: { sellerId: "u_student_1", hostelId: "hostel_bright" },
    bk_4: { sellerId: "u_student_4", hostelId: "hostel_green" },
    bk_5: { sellerId: "u_manager_bright", hostelId: "hostel_bright" },
    bk_6: { sellerId: "u_student_3", hostelId: "hostel_bright" },
  };
  const usedBookMeta: Record<string, { category: string; academicClass: string }> = {
    bk_1: { category: "Academic / Textbook", academicClass: "Honors / University" },
    bk_2: { category: "Academic / Textbook", academicClass: "Honors / University" },
    bk_3: { category: "Academic / Textbook", academicClass: "Honors / University" },
    bk_4: { category: "Academic / Textbook", academicClass: "HSC (Class 11–12)" },
    bk_5: { category: "Academic / Textbook", academicClass: "HSC (Class 11–12)" },
    bk_6: { category: "Others", academicClass: "Others" },
  };
  const usedBookListings: UsedBookListing[] = BOOKS.map((b) => {
    const s = usedBookSellers[b.id] ?? { sellerId: "u_student_1", hostelId: "hostel_bright" };
    const m = usedBookMeta[b.id] ?? { category: "Others", academicClass: "Others" };
    return {
      id: b.id,
      hostelId: s.hostelId,
      sellerId: s.sellerId,
      sellerName: b.seller,
      title: b.title,
      author: b.author,
      category: m.category,
      academicClass: m.academicClass,
      condition: b.condition === "New" ? "Like new" : b.condition,
      price: b.price,
      free: false,
      phone: b.phone,
      createdAt: T,
    };
  });

  return {
    users,
    rooms,
    hostels,
    mealDays,
    menus,
    ratings,
    comments: [],
    reactions: [],
    dutyPlans,
    swapRequests,
    shoppingCosts,
    shortageRequests: [],
    bills,
    payments,
    billAdjustments: [],
    cookLeaveRequests,
    cookAttendanceReports,
    cookAttendanceVotes,
    mealEditRequests: [],
    mealEditVotes: [],
    announcements,
    notifications,
    expenses,
    transferRequests,
    joinRequests,
    mealStopRequests,
    guestMealRequests,
    exploreInteractions: [],
    communityPosts,
    serviceListings,
    campaigns,
    marketingTargets,
    products,
    cartItems: [],
    orders: [],
    usedBookListings,
  };
}

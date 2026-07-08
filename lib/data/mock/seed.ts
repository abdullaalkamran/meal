import type {
  Announcement,
  Bill,
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
  Payment,
  Room,
  User,
} from "../types";
import type { Tables } from "./store";
import { addDays, currentMonth, today } from "../../utils/date";

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
    },
    {
      id: "room_bright_103",
      hostelId: "hostel_bright",
      number: "103",
      capacity: 2,
      occupantIds: ["u_student_3"],
    },
    {
      id: "room_bright_104",
      hostelId: "hostel_bright",
      number: "104",
      capacity: 2,
      occupantIds: [],
    },
    {
      id: "room_bright_202",
      hostelId: "hostel_bright",
      number: "202",
      capacity: 1,
      occupantIds: ["u_manager_bright"],
    },
    {
      id: "room_green_g1",
      hostelId: "hostel_green",
      number: "G1",
      capacity: 2,
      occupantIds: ["u_student_4"],
    },
    {
      id: "room_green_g2",
      hostelId: "hostel_green",
      number: "G2",
      capacity: 1,
      occupantIds: ["u_manager_green"],
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
        { userId: "u_student_1", dates: [T, addDays(T, 1), addDays(T, 2)] },
        {
          userId: "u_student_2",
          dates: [addDays(T, 3), addDays(T, 4), addDays(T, 5)],
        },
        {
          userId: "u_student_3",
          dates: [addDays(T, 6), addDays(T, 7), addDays(T, 8)],
        },
      ],
      spun: { u_student_1: true, u_student_2: true, u_student_3: false },
      budgetPerDay: 2500,
      createdAt: T,
    },
  ];

  const swapRequests = [
    {
      id: "swap_1",
      hostelId: "hostel_bright",
      planId: "duty_shop_1",
      fromUserId: "u_student_2",
      toUserId: "u_student_1",
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
      date: T,
      note: "Weekly market run",
    },
    {
      id: "exp_2",
      hostelId: "hostel_bright",
      category: "Utilities",
      amount: 4200,
      date: T,
      note: "Electricity bill",
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
        },
        {
          label: "serviceCharge",
          items: [
            { label: "Electricity share", amount: 220 },
            { label: "Wifi share", amount: 150 },
            { label: "Cook salary share", amount: 380 },
          ],
          total: 750,
        },
        {
          label: "roomRent",
          items: [{ label: "Room 101 share", amount: 3500 }],
          total: 3500,
        },
      ],
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

  return {
    users,
    rooms,
    hostels,
    mealDays,
    menus,
    ratings: [],
    comments: [],
    reactions: [],
    dutyPlans,
    swapRequests,
    shoppingCosts: [],
    bills,
    payments,
    cookLeaveRequests,
    cookAttendanceReports,
    cookAttendanceVotes,
    announcements,
    notifications,
    expenses,
    transferRequests,
    joinRequests,
    mealStopRequests,
    guestMealRequests,
  };
}

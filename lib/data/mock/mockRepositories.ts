import type {
  AnnouncementRepository,
  BillRepository,
  CommentRepository,
  CookAttendanceRepository,
  CookLeaveRepository,
  DutyRepository,
  ExpenseRepository,
  GuestMealRepository,
  HostelRepository,
  JoinRequestRepository,
  MealRepository,
  MealStopRepository,
  MenuRepository,
  NotificationRepository,
  RatingRepository,
  Repositories,
  RoomRepository,
  ShoppingCostRepository,
  SwapRepository,
  TransferRepository,
  UserRepository,
} from "../repository";
import type { MealDay, MealSlot } from "../types";
import { nextId, store } from "./store";

function emptyMealDay(hostelId: string, date: string): MealDay {
  return { hostelId, date, entries: {} };
}

function ensureMealDay(hostelId: string, date: string): MealDay {
  let day = store.data.mealDays.find(
    (d) => d.hostelId === hostelId && d.date === date
  );
  if (!day) {
    day = emptyMealDay(hostelId, date);
    store.data.mealDays.push(day);
  }
  return day;
}

function ensureMealEntry(day: MealDay, userId: string) {
  if (!day.entries[userId]) {
    day.entries[userId] = {
      breakfast: { on: true, guestCount: 0 },
      lunch: { on: true, guestCount: 0 },
      dinner: { on: true, guestCount: 0 },
    };
  }
  return day.entries[userId];
}

const users: UserRepository = {
  async getUser(userId) {
    return store.data.users.find((u) => u.id === userId);
  },
  async listByHostel(hostelId) {
    // Owners aren't boarders of any single hostel — their `hostelId` is only
    // a fallback/display value, not real membership — so they're excluded
    // from per-hostel member/boarder listings.
    return store.data.users.filter((u) => u.hostelId === hostelId && u.role !== "owner");
  },
  async listAll() {
    return store.data.users;
  },
  async updateUser(userId, patch) {
    const u = store.data.users.find((x) => x.id === userId);
    if (!u) return;
    Object.assign(u, patch);
    store.emit(`users:${u.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () =>
      cb(store.data.users.filter((u) => u.hostelId === hostelId && u.role !== "owner"));
    fire();
    return store.on(`users:${hostelId}`, fire);
  },
};

const rooms: RoomRepository = {
  async listByHostel(hostelId) {
    return store.data.rooms.filter((r) => r.hostelId === hostelId);
  },
  async assignMember(roomId, userId) {
    const room = store.data.rooms.find((r) => r.id === roomId);
    if (!room) return;
    store.data.rooms.forEach((r) => {
      r.occupantIds = r.occupantIds.filter((id) => id !== userId);
    });
    room.occupantIds.push(userId);
    const user = store.data.users.find((u) => u.id === userId);
    if (user) user.roomId = roomId;
    store.emit(`rooms:${room.hostelId}`);
    store.emit(`users:${room.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.rooms.filter((r) => r.hostelId === hostelId));
    fire();
    return store.on(`rooms:${hostelId}`, fire);
  },
};

const hostels: HostelRepository = {
  async getHostel(hostelId) {
    return store.data.hostels.find((h) => h.id === hostelId);
  },
  async listByOwner(ownerId) {
    return store.data.hostels.filter((h) => h.ownerId === ownerId);
  },
  async listAll() {
    return store.data.hostels;
  },
  async updateSettings(hostelId, patch) {
    const h = store.data.hostels.find((x) => x.id === hostelId);
    if (!h) return;
    h.settings = { ...h.settings, ...patch };
    store.emit(`hostel:${hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => {
      const h = store.data.hostels.find((x) => x.id === hostelId);
      if (h) cb(h);
    };
    fire();
    return store.on(`hostel:${hostelId}`, fire);
  },
};

const meals: MealRepository = {
  async getMealDay(hostelId, date) {
    return store.data.mealDays.find((d) => d.hostelId === hostelId && d.date === date) ?? emptyMealDay(hostelId, date);
  },
  async listMealDays(hostelId, range) {
    return store.data.mealDays.filter(
      (d) => d.hostelId === hostelId && d.date >= range.from && d.date <= range.to
    );
  },
  async setMemberMealToggle(hostelId, userId, date, meal, on) {
    const day = ensureMealDay(hostelId, date);
    const entry = ensureMealEntry(day, userId);
    entry[meal].on = on;
    store.emit(`mealDay:${hostelId}`);
  },
  async addGuestMeal(hostelId, userId, date, meal, count) {
    const day = ensureMealDay(hostelId, date);
    const entry = ensureMealEntry(day, userId);
    entry[meal].guestCount += count;
    store.emit(`mealDay:${hostelId}`);
  },
  subscribe(hostelId, cb) {
    // One hostel-wide topic (not per-date) so newly-created days are covered
    // too; the caller (hook) filters by date itself.
    const fire = () => {
      store.data.mealDays
        .filter((d) => d.hostelId === hostelId)
        .forEach((d) => cb(d));
    };
    fire();
    return store.on(`mealDay:${hostelId}`, fire);
  },
};

const menus: MenuRepository = {
  async getMenu(hostelId, date) {
    return store.data.menus.find((m) => m.hostelId === hostelId && m.date === date);
  },
  async saveMenu(hostelId, date, dishes) {
    let menu = store.data.menus.find((m) => m.hostelId === hostelId && m.date === date);
    if (!menu) {
      menu = { hostelId, date, dishes };
      store.data.menus.push(menu);
    } else {
      menu.dishes = dishes;
    }
    store.emit(`menu:${hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () =>
      store.data.menus.filter((m) => m.hostelId === hostelId).forEach((m) => cb(m));
    fire();
    return store.on(`menu:${hostelId}`, fire);
  },
};

const ratings: RatingRepository = {
  async listForDate(hostelId, date) {
    return store.data.ratings.filter((r) => r.hostelId === hostelId && r.date === date);
  },
  async rate(rating) {
    const existing = store.data.ratings.find(
      (r) =>
        r.hostelId === rating.hostelId &&
        r.date === rating.date &&
        r.meal === rating.meal &&
        r.target === rating.target &&
        r.userId === rating.userId
    );
    if (existing) {
      existing.stars = rating.stars;
    } else {
      store.data.ratings.push({ ...rating, id: nextId("rating") });
    }
    store.emit(`ratings:${rating.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.ratings.filter((r) => r.hostelId === hostelId));
    fire();
    return store.on(`ratings:${hostelId}`, fire);
  },
};

const comments: CommentRepository = {
  async listForDate(hostelId, date) {
    return store.data.comments.filter((c) => c.hostelId === hostelId && c.date === date);
  },
  async addComment(comment) {
    store.data.comments.push({
      ...comment,
      id: nextId("comment"),
      createdAt: new Date().toISOString(),
    });
    store.emit(`comments:${comment.hostelId}`);
  },
  async listReactions(commentId) {
    return store.data.reactions.filter((r) => r.commentId === commentId);
  },
  async toggleReaction(commentId, userId, emoji) {
    const existing = store.data.reactions.find(
      (r) => r.commentId === commentId && r.userId === userId && r.emoji === emoji
    );
    if (existing) {
      store.data.reactions = store.data.reactions.filter((r) => r !== existing);
    } else {
      store.data.reactions.push({ id: nextId("reaction"), commentId, userId, emoji });
    }
    const comment = store.data.comments.find((c) => c.id === commentId);
    if (comment) store.emit(`comments:${comment.hostelId}`);
  },
  subscribe(hostelId, cb) {
    return store.on(`comments:${hostelId}`, cb);
  },
};

const duties: DutyRepository = {
  async listByHostel(hostelId) {
    return store.data.dutyPlans.filter((p) => p.hostelId === hostelId);
  },
  async createPlan(plan) {
    const created = {
      ...plan,
      id: nextId("duty"),
      spun: Object.fromEntries(plan.memberIds.map((id) => [id, false])),
      createdAt: new Date().toISOString(),
    };
    store.data.dutyPlans.push(created);
    if (created.requiresSpin) {
      store.data.announcements.push({
        id: nextId("ann"),
        hostelId: plan.hostelId,
        kind: "spin-wheel-cta",
        title: "Spin the wheel — shopping duty",
        body: "A new shopping duty rotation is ready. Spin to reveal your dates.",
        payload: { planId: created.id },
        createdAt: new Date().toISOString(),
      });
      store.emit(`announcements:${plan.hostelId}`);
    }
    store.emit(`duties:${plan.hostelId}`);
    return created;
  },
  async spin(planId, userId) {
    const plan = store.data.dutyPlans.find((p) => p.id === planId);
    if (!plan || plan.spun[userId]) return;
    plan.spun[userId] = true;
    store.emit(`duties:${plan.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.dutyPlans.filter((p) => p.hostelId === hostelId));
    fire();
    return store.on(`duties:${hostelId}`, fire);
  },
};

const swaps: SwapRepository = {
  async listByPlan(planId) {
    return store.data.swapRequests.filter((s) => s.planId === planId);
  },
  async request(swap) {
    store.data.swapRequests.push({
      ...swap,
      id: nextId("swap"),
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    store.data.announcements.push({
      id: nextId("ann"),
      hostelId: swap.hostelId,
      kind: "swap-request",
      title: "Shopping duty swap requested",
      body: "A member wants to swap shopping duty dates with you.",
      payload: { fromUserId: swap.fromUserId, toUserId: swap.toUserId },
      createdAt: new Date().toISOString(),
    });
    store.emit(`swaps:${swap.hostelId}`);
    store.emit(`announcements:${swap.hostelId}`);
  },
  async resolve(swapId, status) {
    const swap = store.data.swapRequests.find((s) => s.id === swapId);
    if (!swap) return;
    swap.status = status;
    if (status === "accepted") {
      const plan = store.data.dutyPlans.find((p) => p.id === swap.planId);
      if (plan) {
        const fromBlock = plan.blocks.find((b) => b.userId === swap.fromUserId);
        const toBlock = plan.blocks.find((b) => b.userId === swap.toUserId);
        if (fromBlock && toBlock) {
          const tmp = fromBlock.dates;
          fromBlock.dates = toBlock.dates;
          toBlock.dates = tmp;
        }
        store.emit(`duties:${plan.hostelId}`);
      }
    }
    store.emit(`swaps:${swap.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.swapRequests.filter((s) => s.hostelId === hostelId));
    fire();
    return store.on(`swaps:${hostelId}`, fire);
  },
};

const shoppingCosts: ShoppingCostRepository = {
  async listByHostel(hostelId) {
    return store.data.shoppingCosts.filter((c) => c.hostelId === hostelId);
  },
  async submit(cost) {
    store.data.shoppingCosts.push({
      ...cost,
      id: nextId("shopcost"),
      createdAt: new Date().toISOString(),
    });
    store.emit(`shoppingCosts:${cost.hostelId}`);
  },
};

const bills: BillRepository = {
  async getBill(hostelId, userId, month) {
    return store.data.bills.find(
      (b) => b.hostelId === hostelId && b.userId === userId && b.month === month
    );
  },
  async listByHostel(hostelId, month) {
    return store.data.bills.filter((b) => b.hostelId === hostelId && b.month === month);
  },
  async listPayments(billId) {
    return store.data.payments.filter((p) => p.billId === billId);
  },
  async pay(payment) {
    store.data.payments.push({ ...payment, id: nextId("pay") });
    const bill = store.data.bills.find((b) => b.id === payment.billId);
    if (bill) {
      bill.paid += payment.amount;
      store.emit(`bill:${bill.userId}`);
    }
  },
  async listPendingVerification(hostelId, month) {
    const billIds = store.data.bills
      .filter((b) => b.hostelId === hostelId && b.month === month)
      .map((b) => b.id);
    return store.data.payments.filter((p) => billIds.includes(p.billId) && !p.verified);
  },
  async decidePayment(paymentId, status) {
    const payment = store.data.payments.find((p) => p.id === paymentId);
    if (!payment) return;
    const bill = store.data.bills.find((b) => b.id === payment.billId);
    if (status === "verified") {
      payment.verified = true;
    } else {
      store.data.payments = store.data.payments.filter((p) => p.id !== paymentId);
      if (bill) bill.paid -= payment.amount;
    }
    if (bill) store.emit(`bill:${bill.userId}`);
  },
  subscribe(userId, cb) {
    return store.on(`bill:${userId}`, () => {
      const bill = store.data.bills.find((b) => b.userId === userId);
      if (bill) cb(bill);
    });
  },
};

const cookLeave: CookLeaveRepository = {
  async listByHostel(hostelId) {
    return store.data.cookLeaveRequests.filter((r) => r.hostelId === hostelId);
  },
  async request(req) {
    store.data.cookLeaveRequests.push({
      ...req,
      id: nextId("cookleave"),
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    store.emit(`cookLeave:${req.hostelId}`);
  },
  async decide(id, status, decidedBy) {
    const req = store.data.cookLeaveRequests.find((r) => r.id === id);
    if (!req) return;
    req.status = status;
    req.decidedBy = decidedBy;
    req.decidedAt = new Date().toISOString();
    if (status === "approved") {
      store.data.announcements.push({
        id: nextId("ann"),
        hostelId: req.hostelId,
        kind: "cook-leave-approved",
        title: "Cook on leave",
        body: `The cook will be on leave from ${req.dateFrom} to ${req.dateTo}.`,
        createdAt: new Date().toISOString(),
      });
      store.emit(`announcements:${req.hostelId}`);
    }
    store.emit(`cookLeave:${req.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.cookLeaveRequests.filter((r) => r.hostelId === hostelId));
    fire();
    return store.on(`cookLeave:${hostelId}`, fire);
  },
};

const cookAttendance: CookAttendanceRepository = {
  async listForDate(hostelId, date) {
    return store.data.cookAttendanceReports.filter(
      (r) => r.hostelId === hostelId && r.date === date
    );
  },
  async report(req) {
    const created = { ...req, id: nextId("cookattend"), createdAt: new Date().toISOString() };
    store.data.cookAttendanceReports.push(created);
    store.data.announcements.push({
      id: nextId("ann"),
      hostelId: req.hostelId,
      kind: "cook-absence-poll",
      title: `Was ${req.meal} cooked today?`,
      body: "The cook hasn't confirmed this meal. Please vote so the manager can decide.",
      payload: { reportId: created.id, meal: req.meal, date: req.date },
      createdAt: new Date().toISOString(),
    });
    store.emit(`cookAttendance:${req.hostelId}`);
    store.emit(`announcements:${req.hostelId}`);
    return created;
  },
  async markCooked(hostelId, date, meal) {
    const report = store.data.cookAttendanceReports.find(
      (r) => r.hostelId === hostelId && r.date === date && r.meal === meal
    );
    if (report) {
      report.status = "resolved_cooked";
    } else {
      // The cook confirming a meal directly (no prior manager report) is
      // recorded the same way — one canonical status per meal per day.
      store.data.cookAttendanceReports.push({
        id: nextId("cookattend"),
        hostelId,
        date,
        meal,
        status: "resolved_cooked",
        reportedBy: "cook",
        createdAt: new Date().toISOString(),
      });
    }
    store.emit(`cookAttendance:${hostelId}`);
  },
  async vote(reportId, userId, choice) {
    const existing = store.data.cookAttendanceVotes.find(
      (v) => v.reportId === reportId && v.userId === userId
    );
    if (existing) {
      existing.choice = choice;
      existing.votedAt = new Date().toISOString();
    } else {
      store.data.cookAttendanceVotes.push({
        reportId,
        userId,
        choice,
        votedAt: new Date().toISOString(),
      });
    }
    const report = store.data.cookAttendanceReports.find((r) => r.id === reportId);
    if (report) store.emit(`cookAttendance:${report.hostelId}`);
  },
  async listVotes(reportId) {
    return store.data.cookAttendanceVotes.filter((v) => v.reportId === reportId);
  },
  async confirmAbsent(reportId) {
    const report = store.data.cookAttendanceReports.find((r) => r.id === reportId);
    if (!report) return;
    report.status = "confirmed_absent";
    const day = ensureMealDay(report.hostelId, report.date);
    Object.values(day.entries).forEach((entry) => {
      entry[report.meal as MealSlot].on = false;
    });
    const ann = store.data.announcements.find(
      (a) => a.kind === "cook-absence-poll" && (a.payload as { reportId?: string })?.reportId === reportId
    );
    if (ann) {
      ann.kind = "cook-absence-resolved";
      ann.title = "Meal cancelled — cook absent";
      ann.body = `${report.meal[0].toUpperCase()}${report.meal.slice(1)} on ${report.date} is cancelled for everyone.`;
    }
    store.emit(`cookAttendance:${report.hostelId}`);
    store.emit(`mealDay:${report.hostelId}`);
    store.emit(`announcements:${report.hostelId}`);
  },
  subscribe(hostelId, cb) {
    return store.on(`cookAttendance:${hostelId}`, cb);
  },
};

const announcements: AnnouncementRepository = {
  async listByHostel(hostelId) {
    return store.data.announcements
      .filter((a) => a.hostelId === hostelId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async post(a) {
    const created = { ...a, id: nextId("ann"), createdAt: new Date().toISOString() };
    store.data.announcements.push(created);
    store.emit(`announcements:${a.hostelId}`);
    return created;
  },
  async update(id, patch) {
    const a = store.data.announcements.find((x) => x.id === id);
    if (!a) return;
    Object.assign(a, patch);
    store.emit(`announcements:${a.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () =>
      cb(
        store.data.announcements
          .filter((a) => a.hostelId === hostelId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    fire();
    return store.on(`announcements:${hostelId}`, fire);
  },
};

const notifications: NotificationRepository = {
  async listByUser(userId) {
    return store.data.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async markRead(id) {
    const n = store.data.notifications.find((x) => x.id === id);
    if (!n) return;
    n.read = true;
    store.emit(`notifications:${n.userId}`);
  },
  subscribe(userId, cb) {
    const fire = () =>
      cb(
        store.data.notifications
          .filter((n) => n.userId === userId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    fire();
    return store.on(`notifications:${userId}`, fire);
  },
};

const expenses: ExpenseRepository = {
  async listByHostel(hostelId) {
    return store.data.expenses.filter((e) => e.hostelId === hostelId);
  },
  async add(expense) {
    store.data.expenses.push({ ...expense, id: nextId("exp") });
    store.emit(`expenses:${expense.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.expenses.filter((e) => e.hostelId === hostelId));
    fire();
    return store.on(`expenses:${hostelId}`, fire);
  },
};

const transfers: TransferRepository = {
  async listByHostel(hostelId) {
    return store.data.transferRequests.filter(
      (t) => t.fromHostelId === hostelId || t.toHostelId === hostelId
    );
  },
  async request(req) {
    store.data.transferRequests.push({
      ...req,
      id: nextId("transfer"),
      stage: "requested",
      timeline: [{ stage: "requested", at: new Date().toISOString() }],
    });
    store.emit(`transfers:${req.fromHostelId}`);
    store.emit(`transfers:${req.toHostelId}`);
  },
  async advance(id, decidedBy, approve) {
    const t = store.data.transferRequests.find((x) => x.id === id);
    if (!t) return;
    const next: Record<string, string> = {
      requested: approve ? "manager_review" : "denied",
      manager_review: approve ? "owner_review" : "denied",
      owner_review: approve ? "approved" : "denied",
    };
    const nextStage = next[t.stage] ?? t.stage;
    t.stage = nextStage as typeof t.stage;
    t.timeline.push({ stage: nextStage, at: new Date().toISOString(), by: decidedBy });

    if (nextStage === "approved") {
      // Final owner approval actually migrates the student: they move to
      // the new hostel and lose their old room (the new hostel's manager
      // assigns a room via the same Add Member flow used for new joiners).
      const member = store.data.users.find((u) => u.id === t.userId);
      if (member) {
        const oldRoom = store.data.rooms.find((r) => r.id === member.roomId);
        if (oldRoom) oldRoom.occupantIds = oldRoom.occupantIds.filter((id) => id !== member.id);
        member.hostelId = t.toHostelId;
        member.roomId = undefined;
        store.emit(`users:${t.fromHostelId}`);
        store.emit(`users:${t.toHostelId}`);
        store.emit(`rooms:${t.fromHostelId}`);
      }
    }

    store.emit(`transfers:${t.fromHostelId}`);
    store.emit(`transfers:${t.toHostelId}`);
  },
  async cancel(id) {
    store.data.transferRequests = store.data.transferRequests.filter((t) => t.id !== id);
  },
  subscribe(hostelId, cb) {
    const fire = () =>
      cb(
        store.data.transferRequests.filter(
          (t) => t.fromHostelId === hostelId || t.toHostelId === hostelId
        )
      );
    fire();
    return store.on(`transfers:${hostelId}`, fire);
  },
};

const joinRequests: JoinRequestRepository = {
  async listByHostel(hostelId) {
    return store.data.joinRequests.filter((r) => r.hostelId === hostelId);
  },
  async create(req) {
    store.data.joinRequests.push({
      ...req,
      id: nextId("join"),
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    store.emit(`joinRequests:${req.hostelId}`);
  },
  async decide(id, status, roomId) {
    const req = store.data.joinRequests.find((r) => r.id === id);
    if (!req) return;
    req.status = status;
    if (status === "approved" && roomId) {
      const room = store.data.rooms.find((r) => r.id === roomId);
      if (room) {
        const newUser = {
          id: nextId("user"),
          hostelId: req.hostelId,
          name: req.name,
          phone: req.phone,
          role: "student" as const,
          roomId,
          avatarSeed: req.name,
        };
        store.data.users.push(newUser);
        room.occupantIds.push(newUser.id);
        store.emit(`users:${req.hostelId}`);
        store.emit(`rooms:${req.hostelId}`);
      }
    }
    store.emit(`joinRequests:${req.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.joinRequests.filter((r) => r.hostelId === hostelId));
    fire();
    return store.on(`joinRequests:${hostelId}`, fire);
  },
};

const mealStops: MealStopRepository = {
  async listByHostel(hostelId) {
    return store.data.mealStopRequests.filter((r) => r.hostelId === hostelId);
  },
  async request(req) {
    store.data.mealStopRequests.push({ ...req, id: nextId("stop"), status: "pending" });
    store.emit(`mealStops:${req.hostelId}`);
  },
  async decide(id, status) {
    const req = store.data.mealStopRequests.find((r) => r.id === id);
    if (!req) return;
    req.status = status;
    if (status === "approved") {
      let d = req.dateFrom;
      while (d <= req.dateTo) {
        const day = ensureMealDay(req.hostelId, d);
        const entry = ensureMealEntry(day, req.userId);
        req.meals.forEach((m) => (entry[m].on = false));
        store.emit(`mealDay:${req.hostelId}`);
        const next = new Date(`${d}T00:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        d = next.toISOString().slice(0, 10);
      }
    }
    store.emit(`mealStops:${req.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.mealStopRequests.filter((r) => r.hostelId === hostelId));
    fire();
    return store.on(`mealStops:${hostelId}`, fire);
  },
};

const guestMeals: GuestMealRepository = {
  async listByHostel(hostelId) {
    return store.data.guestMealRequests.filter((r) => r.hostelId === hostelId);
  },
  async request(req) {
    store.data.guestMealRequests.push({ ...req, id: nextId("guest"), status: "pending" });
    store.emit(`guestMeals:${req.hostelId}`);
  },
  async decide(id, status) {
    const req = store.data.guestMealRequests.find((r) => r.id === id);
    if (!req) return;
    req.status = status;
    if (status === "approved") {
      const day = ensureMealDay(req.hostelId, req.date);
      const entry = ensureMealEntry(day, req.userId);
      entry[req.meal].guestCount += req.qty;
      store.emit(`mealDay:${req.hostelId}`);
    }
    store.emit(`guestMeals:${req.hostelId}`);
  },
  subscribe(hostelId, cb) {
    const fire = () => cb(store.data.guestMealRequests.filter((r) => r.hostelId === hostelId));
    fire();
    return store.on(`guestMeals:${hostelId}`, fire);
  },
};

export const mockRepositories: Repositories = {
  users,
  rooms,
  hostels,
  meals,
  menus,
  ratings,
  comments,
  duties,
  swaps,
  shoppingCosts,
  bills,
  cookLeave,
  cookAttendance,
  announcements,
  notifications,
  expenses,
  transfers,
  joinRequests,
  mealStops,
  guestMeals,
};

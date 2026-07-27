-- Hostel ERP — MySQL 8 schema
--
-- The relational home for the data model in lib/data/types.ts. Targets MySQL
-- 8.0+ (needs CHECK constraints and the JSON type), which is what cPanel /
-- shared hosting provides. Apply with:
--
--   mysql -u USER -p DBNAME < db/schema.mysql.sql
--
-- Conventions
--  * Ids are application-generated strings (lib/data/mock/store.ts nextId(),
--    e.g. "user_m1a2b3_7"), NOT auto-increment or UUID — so every key is
--    VARCHAR(64) and supplied by the app. This keeps ids stable across the
--    JSON-store → MySQL migration.
--  * Timestamps are DATETIME(3) in UTC; calendar dates are DATE; month keys
--    are CHAR(7) ("2026-07").
--  * Array/record fields on the TS types become child tables (a value per
--    row) rather than JSON, so they can be queried and constrained.
--  * ON DELETE CASCADE is used for rows that are meaningless without their
--    parent (a bill's sections, a plan's blocks); real entities use RESTRICT
--    or SET NULL so nothing disappears silently.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ─────────────────────────────────────────────────────────────────────────
-- Core: hostels, users, rooms
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE hostels (
  id                   VARCHAR(64)  NOT NULL PRIMARY KEY,
  name                 VARCHAR(191) NOT NULL,
  -- Short display location ("Mirpur, Dhaka"), derived from the address parts.
  area                 VARCHAR(191) NOT NULL DEFAULT '',
  -- Structured address (lib/geo/bangladesh.ts): division → district → thana.
  division             VARCHAR(64)  NULL,
  district             VARCHAR(64)  NULL,
  thana                VARCHAR(64)  NULL,
  owner_id             VARCHAR(64)  NOT NULL,
  manager_id           VARCHAR(64)  NULL,
  cook_id              VARCHAR(64)  NULL,
  -- DEPRECATED: the real per-meal cost is computed monthly (shopping ÷ meals).
  meal_rate            DECIMAL(10,2) NOT NULL DEFAULT 0,
  kitchen_location     VARCHAR(191) NULL,
  cook_monthly_salary  DECIMAL(10,2) NULL,
  suspended            BOOLEAN      NOT NULL DEFAULT FALSE,
  -- HostelSettings (flattened; per-slot cutoffs live in hostel_meal_cutoffs)
  guest_meal_price          DECIMAL(10,2) NOT NULL DEFAULT 0,
  meal_stop_requires_approval BOOLEAN     NOT NULL DEFAULT TRUE,
  shopping_rotation_policy  ENUM('spin-wheel','manual') NOT NULL DEFAULT 'spin-wheel',
  service_charge_monthly    DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- Detailed street address (house/holding, road, block, level/apartment).
  street                    VARCHAR(255) NULL,
  -- When on, a joining member owes one month's advance rent on their first
  -- bill; it's held (users.advance_held) and credited back when they leave.
  advance_rent_required     BOOLEAN NOT NULL DEFAULT FALSE,
  -- Master meal on/off per slot (HostelSettings.mealsOffered). This is the
  -- CURRENT setting; what each past day actually offered is pinned on
  -- meal_days so history can't be rewritten by changing it.
  offers_breakfast     BOOLEAN NOT NULL DEFAULT TRUE,
  offers_lunch         BOOLEAN NOT NULL DEFAULT TRUE,
  offers_dinner        BOOLEAN NOT NULL DEFAULT TRUE,
  -- Members may toggle a date until this time on the previous day.
  meal_toggle_cutoff   TIME NOT NULL DEFAULT '22:00:00',
  -- The platform's Service Manager verified this hostel's details are genuine.
  verified             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_hostels_owner (owner_id),
  INDEX idx_hostels_area (division, district, thana)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE users (
  id                  VARCHAR(64)  NOT NULL PRIMARY KEY,
  role                ENUM('student','manager','owner','cook','superadmin','marketing','service') NOT NULL,
  name                VARCHAR(191) NOT NULL,
  -- The sign-in identity (phone, server-verified) + the password paired
  -- with it. phone_normalized is phone with all non-digits stripped (see
  -- lib/utils/phone.ts normalizePhone) — the UNIQUE key lives on THIS
  -- column, not raw `phone`, so "01711-123456" and "01711123456" can't
  -- become two accounts just because they're formatted differently.
  phone               VARCHAR(32)  NOT NULL,
  phone_normalized    VARCHAR(20)  NULL,
  email               VARCHAR(191) NULL,
  -- Every account has one (scrypt, lib/data/server/password.ts). New
  -- accounts set it at signup; accounts created by staff (owner adding a
  -- manager/cook) or migrated from before this column existed default to
  -- their own phone number as the password.
  password_hash       VARCHAR(255) NULL,
  avatar_seed         VARCHAR(191) NOT NULL DEFAULT '',
  -- NULL for owners/platform team and for members with no hostel yet.
  hostel_id           VARCHAR(64)  NULL,
  room_id             VARCHAR(64)  NULL,
  student_id          VARCHAR(64)  NULL,
  department          VARCHAR(191) NULL,
  -- Member's home address (same geo vocabulary as hostels).
  division            VARCHAR(64)  NULL,
  district            VARCHAR(64)  NULL,
  thana               VARCHAR(64)  NULL,
  meals_suspended     BOOLEAN      NOT NULL DEFAULT FALSE,
  -- The member's own "turn my future meals off by default" switch.
  meals_default_off   BOOLEAN      NOT NULL DEFAULT FALSE,
  banned              BOOLEAN      NOT NULL DEFAULT FALSE,
  manager_rating      TINYINT      NULL,
  manager_rating_note TEXT         NULL,
  joined_at           DATE         NULL,
  -- Advance rent (৳) currently held for this member (User.advanceHeld) when
  -- the hostel requires it — charged on the first bill, credited on leave.
  advance_held        DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- notificationPrefs: missing key = enabled, so these default TRUE.
  notify_announcements BOOLEAN NOT NULL DEFAULT TRUE,
  notify_bills         BOOLEAN NOT NULL DEFAULT TRUE,
  notify_monthly_report BOOLEAN NOT NULL DEFAULT TRUE,
  -- Service Manager only: comma-separated ServiceKind values (cook/job/course/
  -- offer/hostel) this account is responsible for. Regions live in
  -- availability_areas (entity_type='user'). Assigned by Super Admin;
  -- NULL/empty = unassigned. Informational only, not yet enforced.
  service_kinds       VARCHAR(191) NULL,
  created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_users_phone (phone),
  UNIQUE KEY uq_users_phone_normalized (phone_normalized),
  INDEX idx_users_hostel (hostel_id),
  INDEX idx_users_room (room_id),
  INDEX idx_users_area (division, district, thana),
  CONSTRAINT ck_users_rating CHECK (manager_rating IS NULL OR manager_rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE rooms (
  id         VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id  VARCHAR(64) NOT NULL,
  number     VARCHAR(32) NOT NULL,
  capacity   INT         NOT NULL,
  -- Monthly rent for ONE seat; each occupant pays this (not split).
  seat_rent  DECIMAL(10,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_rooms_hostel_number (hostel_id, number),
  INDEX idx_rooms_hostel (hostel_id),
  CONSTRAINT ck_rooms_capacity CHECK (capacity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Room.facilities: string[]
CREATE TABLE room_facilities (
  room_id  VARCHAR(64)  NOT NULL,
  facility VARCHAR(191) NOT NULL,
  PRIMARY KEY (room_id, facility),
  CONSTRAINT fk_room_facilities_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Which hostel occupancy is authoritative: users.room_id. (The TS model's
-- Room.occupantIds is the inverse of this column.)

-- HostelSettings.managerPermissions — one row per hostel; missing row means
-- the permissive defaults in lib/auth/permissions.ts.
CREATE TABLE manager_permissions (
  hostel_id      VARCHAR(64) NOT NULL PRIMARY KEY,
  rooms          BOOLEAN NOT NULL DEFAULT TRUE,
  members        BOOLEAN NOT NULL DEFAULT TRUE,
  approvals      BOOLEAN NOT NULL DEFAULT TRUE,
  finance        BOOLEAN NOT NULL DEFAULT TRUE,
  billing        BOOLEAN NOT NULL DEFAULT TRUE,
  menu           BOOLEAN NOT NULL DEFAULT TRUE,
  duties         BOOLEAN NOT NULL DEFAULT TRUE,
  announcements  BOOLEAN NOT NULL DEFAULT TRUE,
  -- Whether the MANAGER may hand the manager role to another member.
  assign_manager BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_manager_permissions_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- HostelSettings.mealCutoff: { meal, time }[]
CREATE TABLE hostel_meal_cutoffs (
  hostel_id   VARCHAR(64) NOT NULL,
  meal        ENUM('breakfast','lunch','dinner') NOT NULL,
  cutoff_time TIME NOT NULL,
  PRIMARY KEY (hostel_id, meal),
  CONSTRAINT fk_meal_cutoffs_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE hostels
  ADD CONSTRAINT fk_hostels_owner   FOREIGN KEY (owner_id)   REFERENCES users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_hostels_manager FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_hostels_cook    FOREIGN KEY (cook_id)    REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users
  ADD CONSTRAINT fk_users_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_users_room   FOREIGN KEY (room_id)   REFERENCES rooms(id)   ON DELETE SET NULL;

ALTER TABLE rooms
  ADD CONSTRAINT fk_rooms_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────
-- Meals, menus, feedback
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE meal_days (
  hostel_id        VARCHAR(64) NOT NULL,
  day              DATE        NOT NULL,
  shopping_user_id VARCHAR(64) NULL,
  -- What the hostel offered ON THIS DAY. Pinned per day so that turning a
  -- meal off later changes only today onward — a past day's count stays
  -- exactly what it was (Rule 5/6).
  offers_breakfast BOOLEAN NOT NULL DEFAULT TRUE,
  offers_lunch     BOOLEAN NOT NULL DEFAULT TRUE,
  offers_dinner    BOOLEAN NOT NULL DEFAULT TRUE,
  -- Set once the day has arrived and every active boarder has an explicit
  -- row for it. A sealed day is never re-derived from current state, so
  -- later bans, removals or setting changes can't alter its history.
  sealed_at        DATETIME(3) NULL,
  PRIMARY KEY (hostel_id, day),
  CONSTRAINT fk_meal_days_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  CONSTRAINT fk_meal_days_shopper FOREIGN KEY (shopping_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- MealDay.entries[userId][slot] — one row per user/day/slot. A MISSING row
-- means "on, if the hostel offers that slot" (ensureMealEntry semantics).
CREATE TABLE meal_entries (
  hostel_id   VARCHAR(64) NOT NULL,
  day         DATE        NOT NULL,
  user_id     VARCHAR(64) NOT NULL,
  meal        ENUM('breakfast','lunch','dinner') NOT NULL,
  is_on       BOOLEAN     NOT NULL DEFAULT TRUE,
  guest_count INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (hostel_id, day, user_id, meal),
  INDEX idx_meal_entries_user (user_id, day),
  CONSTRAINT fk_meal_entries_day  FOREIGN KEY (hostel_id, day) REFERENCES meal_days(hostel_id, day) ON DELETE CASCADE,
  CONSTRAINT fk_meal_entries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT ck_meal_entries_guests CHECK (guest_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE menus (
  hostel_id VARCHAR(64) NOT NULL,
  day       DATE        NOT NULL,
  PRIMARY KEY (hostel_id, day),
  CONSTRAINT fk_menus_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Menu.dishes: Record<MealSlot, string[]>
CREATE TABLE menu_dishes (
  hostel_id VARCHAR(64) NOT NULL,
  day       DATE        NOT NULL,
  meal      ENUM('breakfast','lunch','dinner') NOT NULL,
  position  INT         NOT NULL,
  dish      VARCHAR(191) NOT NULL,
  PRIMARY KEY (hostel_id, day, meal, position),
  CONSTRAINT fk_menu_dishes_menu FOREIGN KEY (hostel_id, day) REFERENCES menus(hostel_id, day) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE ratings (
  id        VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id VARCHAR(64) NOT NULL,
  user_id   VARCHAR(64) NOT NULL,
  day       DATE        NOT NULL,
  meal      ENUM('breakfast','lunch','dinner') NOT NULL,
  target    ENUM('menu','cook','manager') NOT NULL,
  stars     TINYINT     NOT NULL,
  -- One rating per user per meal per target per day (upsert target).
  UNIQUE KEY uq_ratings_one (hostel_id, day, meal, target, user_id),
  INDEX idx_ratings_hostel_day (hostel_id, day),
  CONSTRAINT fk_ratings_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  CONSTRAINT fk_ratings_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT ck_ratings_stars CHECK (stars BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE comments (
  id         VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id  VARCHAR(64) NOT NULL,
  day        DATE        NOT NULL,
  user_id    VARCHAR(64) NOT NULL,
  body       TEXT        NOT NULL,
  created_at DATETIME(3) NOT NULL,
  INDEX idx_comments_hostel_day (hostel_id, day),
  CONSTRAINT fk_comments_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE comment_reactions (
  id         VARCHAR(64) NOT NULL PRIMARY KEY,
  comment_id VARCHAR(64) NOT NULL,
  user_id    VARCHAR(64) NOT NULL,
  emoji      VARCHAR(16) NOT NULL,
  UNIQUE KEY uq_reaction_once (comment_id, user_id, emoji),
  CONSTRAINT fk_reactions_comment FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  CONSTRAINT fk_reactions_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────
-- Duties (shopping / cleaning rotations)
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE duty_plans (
  id              VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id       VARCHAR(64) NOT NULL,
  type            ENUM('shopping','cleaning') NOT NULL,
  requires_spin   BOOLEAN     NOT NULL DEFAULT FALSE,
  start_date      DATE        NOT NULL,
  end_date        DATE        NOT NULL,
  budget_per_day  DECIMAL(10,2) NULL,
  -- How many members share one block when they spin to claim it (1 solo, 2 companion).
  group_size      INT         NOT NULL DEFAULT 1,
  created_at      DATETIME(3) NOT NULL,
  INDEX idx_duty_plans_hostel (hostel_id),
  CONSTRAINT fk_duty_plans_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- DutyPlan.memberIds + DutyPlan.spun (per-member reveal flag)
CREATE TABLE duty_plan_members (
  plan_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  spun    BOOLEAN     NOT NULL DEFAULT FALSE,
  PRIMARY KEY (plan_id, user_id),
  CONSTRAINT fk_duty_members_plan FOREIGN KEY (plan_id) REFERENCES duty_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_duty_members_user FOREIGN KEY (user_id) REFERENCES users(id)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- DutyPlan.blocks[]: each block has 1 member (individual) or 2 (companion pair)
CREATE TABLE duty_blocks (
  id       VARCHAR(64) NOT NULL PRIMARY KEY,
  plan_id  VARCHAR(64) NOT NULL,
  position INT         NOT NULL,
  UNIQUE KEY uq_duty_blocks_pos (plan_id, position),
  CONSTRAINT fk_duty_blocks_plan FOREIGN KEY (plan_id) REFERENCES duty_plans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE duty_block_members (
  block_id VARCHAR(64) NOT NULL,
  user_id  VARCHAR(64) NOT NULL,
  PRIMARY KEY (block_id, user_id),
  CONSTRAINT fk_block_members_block FOREIGN KEY (block_id) REFERENCES duty_blocks(id) ON DELETE CASCADE,
  CONSTRAINT fk_block_members_user  FOREIGN KEY (user_id)  REFERENCES users(id)       ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE duty_block_dates (
  block_id VARCHAR(64) NOT NULL,
  day      DATE        NOT NULL,
  PRIMARY KEY (block_id, day),
  CONSTRAINT fk_block_dates_block FOREIGN KEY (block_id) REFERENCES duty_blocks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE swap_requests (
  id           VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id    VARCHAR(64) NOT NULL,
  plan_id      VARCHAR(64) NOT NULL,
  from_user_id VARCHAR(64) NOT NULL,
  to_user_id   VARCHAR(64) NOT NULL,
  status       ENUM('pending','accepted','denied','cancelled') NOT NULL DEFAULT 'pending',
  created_at   DATETIME(3) NOT NULL,
  INDEX idx_swaps_hostel (hostel_id),
  INDEX idx_swaps_plan (plan_id),
  CONSTRAINT fk_swaps_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id)   ON DELETE CASCADE,
  CONSTRAINT fk_swaps_plan   FOREIGN KEY (plan_id)   REFERENCES duty_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_swaps_from   FOREIGN KEY (from_user_id) REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_swaps_to     FOREIGN KEY (to_user_id)   REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────
-- Shopping spend & shortages
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE shopping_costs (
  id         VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id  VARCHAR(64) NOT NULL,
  user_id    VARCHAR(64) NOT NULL,
  amount     DECIMAL(10,2) NOT NULL,
  items      TEXT        NULL,
  -- Manager must approve before this counts toward the month's actual meal
  -- rate (mealRateFor sums 'approved' only) — an unreviewed number a member
  -- typed in no longer silently inflates/deflates everyone's bill.
  status     ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending',
  -- Set when the manager entered this on a member's behalf (auto-approved).
  -- Shown to everyone so it's transparent the manager recorded it, not the member.
  added_by_manager BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL,
  INDEX idx_shopping_hostel (hostel_id),
  CONSTRAINT fk_shopping_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  CONSTRAINT fk_shopping_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Browser Web Push subscriptions — one row per browser per user, so the server
-- can push notifications even when the app is closed. Endpoint is unique so a
-- browser re-subscribing upserts instead of duplicating.
CREATE TABLE push_subscriptions (
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  user_id    VARCHAR(64)  NOT NULL,
  endpoint   VARCHAR(512) NOT NULL,
  p256dh     TEXT         NOT NULL,
  auth       TEXT         NOT NULL,
  created_at DATETIME(3)  NOT NULL,
  UNIQUE KEY uq_push_endpoint (endpoint(191)),
  INDEX idx_push_user (user_id),
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ShoppingCost.dates: string[] — the duty days this spend covers. The monthly
-- meal rate sums costs whose dates fall in the month.
CREATE TABLE shopping_cost_dates (
  cost_id VARCHAR(64) NOT NULL,
  day     DATE        NOT NULL,
  PRIMARY KEY (cost_id, day),
  INDEX idx_shopping_dates_day (day),
  CONSTRAINT fk_shopping_dates_cost FOREIGN KEY (cost_id) REFERENCES shopping_costs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE shortage_requests (
  id          VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id   VARCHAR(64) NOT NULL,
  cook_id     VARCHAR(64) NOT NULL,
  items       TEXT        NOT NULL,
  status      ENUM('pending','resolved') NOT NULL DEFAULT 'pending',
  resolved_by VARCHAR(64) NULL,
  resolved_at DATETIME(3) NULL,
  created_at  DATETIME(3) NOT NULL,
  INDEX idx_shortages_hostel (hostel_id),
  CONSTRAINT fk_shortages_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  CONSTRAINT fk_shortages_cook   FOREIGN KEY (cook_id)   REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────
-- Expenses & billing
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE expenses (
  id            VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id     VARCHAR(64) NOT NULL,
  category      VARCHAR(64) NOT NULL,
  -- "fixed" = this amount EACH selected member pays; "equal" = total split.
  amount        DECIMAL(10,2) NOT NULL,
  split_mode    ENUM('fixed','equal') NOT NULL,
  date_from     DATE        NOT NULL,
  date_to       DATE        NOT NULL,
  note          TEXT        NULL,
  -- The month this is charged in (may differ from the period it covers).
  billing_month CHAR(7)     NOT NULL,
  -- Set once folded into a generated bill: locks it from deletion/re-offering.
  billed_at     DATETIME(3) NULL,
  INDEX idx_expenses_hostel_month (hostel_id, billing_month),
  CONSTRAINT fk_expenses_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE expense_members (
  expense_id VARCHAR(64) NOT NULL,
  user_id    VARCHAR(64) NOT NULL,
  PRIMARY KEY (expense_id, user_id),
  CONSTRAINT fk_expense_members_expense FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
  CONSTRAINT fk_expense_members_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bills (
  id                     VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id              VARCHAR(64) NOT NULL,
  user_id                VARCHAR(64) NOT NULL,
  month                  CHAR(7)     NOT NULL,
  meals_count            INT         NOT NULL DEFAULT 0,
  previous_balance       DECIMAL(10,2) NOT NULL DEFAULT 0,
  previous_balance_paid  DECIMAL(10,2) NOT NULL DEFAULT 0,
  grand_total            DECIMAL(10,2) NOT NULL DEFAULT 0,
  paid                   DECIMAL(10,2) NOT NULL DEFAULT 0,
  due_date               DATE        NULL,
  UNIQUE KEY uq_bills_one_per_month (hostel_id, user_id, month),
  INDEX idx_bills_user (user_id),
  CONSTRAINT fk_bills_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  CONSTRAINT fk_bills_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bill_sections (
  id      VARCHAR(64) NOT NULL PRIMARY KEY,
  bill_id VARCHAR(64) NOT NULL,
  label   ENUM('mealCost','serviceCharge','roomRent','cookSalary') NOT NULL,
  total   DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- Tracked per section: a member may owe rent but have meal-cost credit.
  paid    DECIMAL(10,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uq_bill_section (bill_id, label),
  CONSTRAINT fk_bill_sections_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bill_line_items (
  id         VARCHAR(64)  NOT NULL PRIMARY KEY,
  section_id VARCHAR(64)  NOT NULL,
  position   INT          NOT NULL,
  label      VARCHAR(255) NOT NULL,
  amount     DECIMAL(10,2) NOT NULL,
  UNIQUE KEY uq_line_item_pos (section_id, position),
  CONSTRAINT fk_line_items_section FOREIGN KEY (section_id) REFERENCES bill_sections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payments (
  id            VARCHAR(64) NOT NULL PRIMARY KEY,
  bill_id       VARCHAR(64) NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  paid_at       DATETIME(3) NOT NULL,
  method        ENUM('bKash','Nagad','Card','Cash') NOT NULL,
  reference     VARCHAR(191) NULL,
  -- The number/account the money came from, for statement matching.
  sender_number VARCHAR(64) NULL,
  verified      BOOLEAN     NOT NULL DEFAULT FALSE,
  INDEX idx_payments_bill (bill_id),
  CONSTRAINT fk_payments_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Payment.targets[] — which parts of the bill this payment was meant for.
CREATE TABLE payment_targets (
  payment_id VARCHAR(64) NOT NULL,
  target     ENUM('mealCost','serviceCharge','roomRent','cookSalary','previousBalance') NOT NULL,
  PRIMARY KEY (payment_id, target),
  CONSTRAINT fk_payment_targets_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Payment.breakdown — the split actually applied, so a rejection reverses
-- exactly what was applied rather than re-deriving it from changed state.
CREATE TABLE payment_breakdown (
  payment_id VARCHAR(64) NOT NULL,
  target     ENUM('mealCost','serviceCharge','roomRent','cookSalary','previousBalance') NOT NULL,
  amount     DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (payment_id, target),
  CONSTRAINT fk_payment_breakdown_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Settling meal-cost credit: refunded in cash, or moved to another category.
CREATE TABLE bill_adjustments (
  id           VARCHAR(64) NOT NULL PRIMARY KEY,
  bill_id      VARCHAR(64) NOT NULL,
  user_id      VARCHAR(64) NOT NULL,
  amount       DECIMAL(10,2) NOT NULL,
  kind         ENUM('refund','transfer') NOT NULL,
  from_target  ENUM('mealCost','serviceCharge','roomRent','cookSalary','previousBalance') NOT NULL,
  to_target    ENUM('mealCost','serviceCharge','roomRent','cookSalary','previousBalance') NULL,
  note         TEXT        NULL,
  created_at   DATETIME(3) NOT NULL,
  INDEX idx_adjustments_bill (bill_id),
  CONSTRAINT fk_adjustments_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  CONSTRAINT fk_adjustments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────
-- Cook attendance & leave, meal-edit votes
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE cook_leave_requests (
  id         VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id  VARCHAR(64) NOT NULL,
  cook_id    VARCHAR(64) NOT NULL,
  date_from  DATE        NOT NULL,
  date_to    DATE        NOT NULL,
  scope      ENUM('full-day','partial') NOT NULL,
  reason     TEXT        NOT NULL,
  status     ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending',
  decided_by VARCHAR(64) NULL,
  decided_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  INDEX idx_cook_leave_hostel (hostel_id),
  CONSTRAINT fk_cook_leave_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  CONSTRAINT fk_cook_leave_cook   FOREIGN KEY (cook_id)   REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CookLeaveRequest.meals[] — only present when scope = 'partial'.
CREATE TABLE cook_leave_meals (
  request_id VARCHAR(64) NOT NULL,
  meal       ENUM('breakfast','lunch','dinner') NOT NULL,
  PRIMARY KEY (request_id, meal),
  CONSTRAINT fk_cook_leave_meals_req FOREIGN KEY (request_id) REFERENCES cook_leave_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cook_attendance_reports (
  id          VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id   VARCHAR(64) NOT NULL,
  day         DATE        NOT NULL,
  meal        ENUM('breakfast','lunch','dinner') NOT NULL,
  status      ENUM('reported','confirmed_absent','resolved_cooked') NOT NULL DEFAULT 'reported',
  reported_by VARCHAR(64) NOT NULL,
  created_at  DATETIME(3) NOT NULL,
  -- One canonical status per meal per day per hostel.
  UNIQUE KEY uq_cook_attendance (hostel_id, day, meal),
  CONSTRAINT fk_cook_attendance_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cook_attendance_votes (
  report_id VARCHAR(64) NOT NULL,
  user_id   VARCHAR(64) NOT NULL,
  choice    ENUM('yes','no','dk') NOT NULL,
  voted_at  DATETIME(3) NOT NULL,
  PRIMARY KEY (report_id, user_id),
  CONSTRAINT fk_cook_votes_report FOREIGN KEY (report_id) REFERENCES cook_attendance_reports(id) ON DELETE CASCADE,
  CONSTRAINT fk_cook_votes_user   FOREIGN KEY (user_id)   REFERENCES users(id)                   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE meal_edit_requests (
  id             VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id      VARCHAR(64) NOT NULL,
  target_user_id VARCHAR(64) NOT NULL,
  day            DATE        NOT NULL,
  reason         TEXT        NOT NULL,
  requested_by   VARCHAR(64) NOT NULL,
  status         ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending',
  created_at     DATETIME(3) NOT NULL,
  INDEX idx_meal_edits_hostel (hostel_id),
  CONSTRAINT fk_meal_edits_hostel FOREIGN KEY (hostel_id)      REFERENCES hostels(id) ON DELETE CASCADE,
  CONSTRAINT fk_meal_edits_target FOREIGN KEY (target_user_id) REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE meal_edit_votes (
  request_id VARCHAR(64) NOT NULL,
  user_id    VARCHAR(64) NOT NULL,
  choice     ENUM('yes','no') NOT NULL,
  voted_at   DATETIME(3) NOT NULL,
  PRIMARY KEY (request_id, user_id),
  CONSTRAINT fk_meal_edit_votes_req  FOREIGN KEY (request_id) REFERENCES meal_edit_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_meal_edit_votes_user FOREIGN KEY (user_id)    REFERENCES users(id)              ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Manager's proposed change to one member's recorded shopping cost, gated by
-- the same hostel-wide vote as meal edits; auto-applies at half the boarders.
CREATE TABLE shopping_cost_edit_requests (
  id             VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id      VARCHAR(64) NOT NULL,
  cost_id        VARCHAR(64) NOT NULL,
  target_user_id VARCHAR(64) NOT NULL,
  current_amount DECIMAL(10,2) NOT NULL,
  new_amount     DECIMAL(10,2) NOT NULL,
  new_items      TEXT        NULL,
  reason         TEXT        NOT NULL,
  requested_by   VARCHAR(64) NOT NULL,
  status         ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending',
  created_at     DATETIME(3) NOT NULL,
  INDEX idx_shop_edits_hostel (hostel_id),
  CONSTRAINT fk_shop_edits_hostel FOREIGN KEY (hostel_id)      REFERENCES hostels(id)        ON DELETE CASCADE,
  CONSTRAINT fk_shop_edits_cost   FOREIGN KEY (cost_id)        REFERENCES shopping_costs(id) ON DELETE CASCADE,
  CONSTRAINT fk_shop_edits_target FOREIGN KEY (target_user_id) REFERENCES users(id)          ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE shopping_cost_edit_votes (
  request_id VARCHAR(64) NOT NULL,
  user_id    VARCHAR(64) NOT NULL,
  choice     ENUM('yes','no') NOT NULL,
  voted_at   DATETIME(3) NOT NULL,
  PRIMARY KEY (request_id, user_id),
  CONSTRAINT fk_shop_edit_votes_req  FOREIGN KEY (request_id) REFERENCES shopping_cost_edit_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_shop_edit_votes_user FOREIGN KEY (user_id)    REFERENCES users(id)                       ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────
-- Requests: join, transfer, meal stop, guest meal
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE join_requests (
  id         VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id  VARCHAR(64) NOT NULL,
  -- Always set now: only platform account holders may request to join.
  user_id    VARCHAR(64) NULL,
  name       VARCHAR(191) NOT NULL,
  phone      VARCHAR(32)  NOT NULL,
  status     ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending',
  created_at DATETIME(3) NOT NULL,
  INDEX idx_join_hostel (hostel_id),
  INDEX idx_join_user (user_id),
  CONSTRAINT fk_join_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  CONSTRAINT fk_join_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE transfer_requests (
  id             VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id        VARCHAR(64) NOT NULL,
  from_hostel_id VARCHAR(64) NOT NULL,
  to_hostel_id   VARCHAR(64) NOT NULL,
  reason         TEXT        NOT NULL,
  stage          ENUM('requested','manager_review','owner_review','approved','denied') NOT NULL DEFAULT 'requested',
  INDEX idx_transfers_from (from_hostel_id),
  INDEX idx_transfers_to (to_hostel_id),
  CONSTRAINT fk_transfers_user FOREIGN KEY (user_id)        REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT fk_transfers_from FOREIGN KEY (from_hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  CONSTRAINT fk_transfers_to   FOREIGN KEY (to_hostel_id)   REFERENCES hostels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE transfer_timeline (
  id          VARCHAR(64) NOT NULL PRIMARY KEY,
  transfer_id VARCHAR(64) NOT NULL,
  position    INT         NOT NULL,
  stage       VARCHAR(32) NOT NULL,
  at          DATETIME(3) NOT NULL,
  by_user_id  VARCHAR(64) NULL,
  UNIQUE KEY uq_timeline_pos (transfer_id, position),
  CONSTRAINT fk_timeline_transfer FOREIGN KEY (transfer_id) REFERENCES transfer_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE leave_requests (
  id           VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id    VARCHAR(64) NOT NULL,
  user_id      VARCHAR(64) NOT NULL,
  requested_at DATETIME(3) NOT NULL,
  leave_date   DATE        NOT NULL,
  reason       TEXT        NULL,
  status       ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending',
  decided_by   VARCHAR(64) NULL,
  decided_at   DATETIME(3) NULL,
  INDEX idx_leave_requests_hostel (hostel_id),
  INDEX idx_leave_requests_user (user_id),
  CONSTRAINT fk_leave_requests_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  CONSTRAINT fk_leave_requests_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE meal_stop_requests (
  id        VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id VARCHAR(64) NOT NULL,
  user_id   VARCHAR(64) NOT NULL,
  date_from DATE        NOT NULL,
  date_to   DATE        NOT NULL,
  reason    TEXT        NULL,
  -- What approval should set the meal to. FALSE (the default, and all legacy
  -- rows) means "stop these meals"; TRUE means the member is asking to turn
  -- them back ON after the toggle locked.
  desired_on BOOLEAN    NOT NULL DEFAULT FALSE,
  status    ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending',
  INDEX idx_meal_stops_hostel (hostel_id),
  CONSTRAINT fk_meal_stops_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  CONSTRAINT fk_meal_stops_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE meal_stop_meals (
  request_id VARCHAR(64) NOT NULL,
  meal       ENUM('breakfast','lunch','dinner') NOT NULL,
  PRIMARY KEY (request_id, meal),
  CONSTRAINT fk_meal_stop_meals_req FOREIGN KEY (request_id) REFERENCES meal_stop_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE guest_meal_requests (
  id         VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id  VARCHAR(64) NOT NULL,
  user_id    VARCHAR(64) NOT NULL,
  meal       ENUM('breakfast','lunch','dinner') NOT NULL,
  day        DATE        NOT NULL,
  guest_name VARCHAR(191) NOT NULL,
  qty        INT         NOT NULL DEFAULT 1,
  status     ENUM('pending','approved','denied') NOT NULL DEFAULT 'pending',
  INDEX idx_guest_meals_hostel (hostel_id),
  CONSTRAINT fk_guest_meals_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
  CONSTRAINT fk_guest_meals_user   FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE,
  CONSTRAINT ck_guest_qty CHECK (qty > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────
-- Announcements, notifications, activity log
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE announcements (
  id         VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id  VARCHAR(64) NOT NULL,
  kind       ENUM('general','cook-absence-poll','cook-absence-resolved','cook-leave-approved',
                  'spin-wheel-cta','swap-request','swap-completed','swap-denied','shortage-alert',
                  'meal-edit-poll','meal-edit-resolved',
                  'shopping-cost-edit-poll','shopping-cost-edit-resolved') NOT NULL DEFAULT 'general',
  title      VARCHAR(255) NOT NULL,
  body       TEXT         NOT NULL,
  -- Small kind-specific bag (reportId, planId, requestId…): stays JSON because
  -- its shape varies per announcement kind and is never queried relationally.
  payload    JSON         NULL,
  created_at DATETIME(3)  NOT NULL,
  INDEX idx_announcements_hostel (hostel_id, created_at),
  CONSTRAINT fk_announcements_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notifications (
  id              VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id         VARCHAR(64) NOT NULL,
  announcement_id VARCHAR(64) NULL,
  title           VARCHAR(255) NOT NULL,
  body            TEXT         NOT NULL,
  is_read         BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      DATETIME(3)  NOT NULL,
  INDEX idx_notifications_user (user_id, created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notifications_ann  FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE activity_logs (
  id         VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id  VARCHAR(64) NOT NULL,
  -- Denormalised actor name: the log must still read correctly if the user
  -- is later removed, so this is a snapshot, not a join.
  actor_id   VARCHAR(64)  NOT NULL,
  actor_name VARCHAR(191) NOT NULL,
  action     VARCHAR(191) NOT NULL,
  detail     TEXT         NULL,
  created_at DATETIME(3)  NOT NULL,
  INDEX idx_activity_hostel (hostel_id, created_at),
  CONSTRAINT fk_activity_hostel FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─────────────────────────────────────────────────────────────────────────
-- Explore / platform catalogs
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE explore_interactions (
  id         VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id    VARCHAR(64) NOT NULL,
  feature    ENUM('jobs','learning','books','offers','cooks','investment','studyabroad') NOT NULL,
  item_id    VARCHAR(64) NOT NULL,
  kind       ENUM('applied','enrolled','saved','grabbed') NOT NULL,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uq_interaction (user_id, feature, item_id, kind),
  CONSTRAINT fk_interactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE community_posts (
  id          VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id   VARCHAR(64) NULL,
  user_id     VARCHAR(64) NOT NULL,
  author_name VARCHAR(191) NOT NULL,
  body        TEXT         NOT NULL,
  created_at  DATETIME(3)  NOT NULL,
  INDEX idx_community_created (created_at),
  CONSTRAINT fk_community_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE community_post_likes (
  post_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  PRIMARY KEY (post_id, user_id),
  CONSTRAINT fk_post_likes_post FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_post_likes_user FOREIGN KEY (user_id) REFERENCES users(id)           ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One table across listing kinds: shared columns are real, and the fields that
-- differ per kind live in `attrs` (cuisine, company, provider, discount…).
CREATE TABLE service_listings (
  id         VARCHAR(64) NOT NULL PRIMARY KEY,
  kind       ENUM('cook','job','course','offer','hostel') NOT NULL,
  title      VARCHAR(255) NOT NULL,
  active     BOOLEAN      NOT NULL DEFAULT TRUE,
  attrs      JSON         NULL,
  created_at DATETIME(3)  NOT NULL,
  INDEX idx_listings_kind (kind, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE products (
  id             VARCHAR(64) NOT NULL PRIMARY KEY,
  kind           ENUM('grocery','book') NOT NULL,
  name           VARCHAR(255) NOT NULL,
  price          DECIMAL(10,2) NOT NULL,
  category       VARCHAR(64)  NOT NULL,
  -- Uploaded photo as a data URL (no external image host).
  image          MEDIUMTEXT   NULL,
  active         BOOLEAN      NOT NULL DEFAULT TRUE,
  unit           VARCHAR(64)  NULL,
  author         VARCHAR(191) NULL,
  academic_class VARCHAR(64)  NULL,
  created_at     DATETIME(3)  NOT NULL,
  INDEX idx_products_kind (kind, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Where a platform service/product is available (GeoArea[]). NO rows for an
-- entity means "available everywhere"; a row with NULL district covers the
-- whole division, NULL thana the whole district.
CREATE TABLE availability_areas (
  id          VARCHAR(64) NOT NULL PRIMARY KEY,
  entity_type ENUM('service_listing','product') NOT NULL,
  entity_id   VARCHAR(64) NOT NULL,
  division    VARCHAR(64) NOT NULL,
  district    VARCHAR(64) NULL,
  thana       VARCHAR(64) NULL,
  INDEX idx_areas_entity (entity_type, entity_id),
  INDEX idx_areas_place (division, district, thana)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE cart_items (
  id         VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id    VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NOT NULL,
  qty        INT         NOT NULL DEFAULT 1,
  UNIQUE KEY uq_cart_line (user_id, product_id),
  CONSTRAINT fk_cart_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_cart_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT ck_cart_qty CHECK (qty > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE orders (
  id             VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id        VARCHAR(64) NOT NULL,
  hostel_id      VARCHAR(64) NULL,
  subtotal       DECIMAL(10,2) NOT NULL DEFAULT 0,
  delivery_fee   DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount       DECIMAL(10,2) NOT NULL DEFAULT 0,
  coupon_code    VARCHAR(32) NULL,
  total          DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method ENUM('bKash','Nagad','Card','Cash') NOT NULL,
  status         ENUM('placed','confirmed','preparing','picked_up','on_the_way','delivered','cancelled') NOT NULL DEFAULT 'placed',
  note           TEXT        NULL,
  buyer_phone    VARCHAR(32) NULL,
  created_at     DATETIME(3) NOT NULL,
  INDEX idx_orders_user (user_id, created_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Snapshot of what was bought: copied from the product so later catalog
-- edits never rewrite order history.
CREATE TABLE order_items (
  id         VARCHAR(64) NOT NULL PRIMARY KEY,
  order_id   VARCHAR(64) NOT NULL,
  product_id VARCHAR(64) NULL,
  kind       ENUM('grocery','book') NOT NULL,
  name       VARCHAR(255) NOT NULL,
  qty        INT          NOT NULL,
  price      DECIMAL(10,2) NOT NULL,
  INDEX idx_order_items_order (order_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE coupons (
  id               VARCHAR(64) NOT NULL PRIMARY KEY,
  code             VARCHAR(32) NOT NULL,
  kind             ENUM('percent','flat') NOT NULL,
  value            DECIMAL(10,2) NOT NULL,
  active           BOOLEAN     NOT NULL DEFAULT TRUE,
  min_order_amount DECIMAL(10,2) NULL,
  max_uses         INT         NULL,
  used_count       INT         NOT NULL DEFAULT 0,
  expires_at       DATE        NULL,
  created_at       DATETIME(3) NOT NULL,
  UNIQUE KEY uq_coupons_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Single-row store-wide delivery fee policy, same pattern as hero_promo_settings.
CREATE TABLE store_settings (
  id                      TINYINT     NOT NULL PRIMARY KEY DEFAULT 1,
  delivery_fee_enabled    BOOLEAN     NOT NULL DEFAULT TRUE,
  delivery_fee            DECIMAL(10,2) NOT NULL DEFAULT 30,
  free_delivery_min_amount DECIMAL(10,2) NULL,
  CONSTRAINT ck_store_settings_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE used_book_listings (
  id             VARCHAR(64) NOT NULL PRIMARY KEY,
  hostel_id      VARCHAR(64) NULL,
  seller_id      VARCHAR(64) NOT NULL,
  seller_name    VARCHAR(191) NOT NULL,
  title          VARCHAR(255) NOT NULL,
  author         VARCHAR(191) NOT NULL,
  category       VARCHAR(64)  NOT NULL,
  academic_class VARCHAR(64)  NOT NULL,
  book_condition ENUM('Like new','Good','Fair') NOT NULL,
  price          DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_free        BOOLEAN      NOT NULL DEFAULT FALSE,
  phone          VARCHAR(32)  NOT NULL,
  image          MEDIUMTEXT   NULL,
  created_at     DATETIME(3)  NOT NULL,
  INDEX idx_used_books_created (created_at),
  CONSTRAINT fk_used_books_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE study_abroad_items (
  id         VARCHAR(64) NOT NULL PRIMARY KEY,
  kind       ENUM('country','scholarship','counsellor','promo','blog') NOT NULL,
  title      VARCHAR(255) NOT NULL,
  active     BOOLEAN      NOT NULL DEFAULT TRUE,
  image      MEDIUMTEXT   NULL,
  attrs      JSON         NULL,
  created_at DATETIME(3)  NOT NULL,
  INDEX idx_study_kind (kind, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE study_leads (
  id                 VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id            VARCHAR(64) NULL,
  name               VARCHAR(191) NOT NULL,
  phone              VARCHAR(32)  NOT NULL,
  email              VARCHAR(191) NOT NULL,
  last_academic      VARCHAR(191) NOT NULL,
  english_test       VARCHAR(191) NOT NULL,
  interested_country VARCHAR(191) NOT NULL,
  subjects           TEXT         NOT NULL,
  contacted          BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at         DATETIME(3)  NOT NULL,
  INDEX idx_leads_created (created_at),
  CONSTRAINT fk_leads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE campaigns (
  id         VARCHAR(64) NOT NULL PRIMARY KEY,
  name       VARCHAR(191) NOT NULL,
  channel    VARCHAR(64)  NOT NULL,
  status     ENUM('planned','running','done') NOT NULL DEFAULT 'planned',
  start_date DATE         NOT NULL,
  budget     DECIMAL(12,2) NOT NULL DEFAULT 0,
  note       TEXT         NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE marketing_targets (
  metric VARCHAR(64) NOT NULL,
  month  CHAR(7)     NOT NULL,
  target DECIMAL(14,2) NOT NULL,
  PRIMARY KEY (metric, month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Single-row table (id is always 1) for the homepage promo carousel settings.
-- Home-page promotions the Service Manager uploads: wide hero banners and
-- square login-popup cards. Image is an uploaded photo stored as a data URL.
CREATE TABLE promotions (
  id         VARCHAR(64) NOT NULL PRIMARY KEY,
  placement  ENUM('hero','popup') NOT NULL,
  image      MEDIUMTEXT  NOT NULL,
  title      VARCHAR(191) NULL,
  tagline    VARCHAR(255) NULL,
  link_url   VARCHAR(512) NULL,
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL,
  INDEX idx_promotions_placement (placement, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE hero_promo_settings (
  id              TINYINT NOT NULL PRIMARY KEY DEFAULT 1,
  source_study    BOOLEAN NOT NULL DEFAULT TRUE,
  source_offers   BOOLEAN NOT NULL DEFAULT TRUE,
  source_grocery  BOOLEAN NOT NULL DEFAULT TRUE,
  source_books    BOOLEAN NOT NULL DEFAULT TRUE,
  interval_sec    INT     NOT NULL DEFAULT 4,
  photo_height_px INT     NOT NULL DEFAULT 150,
  CONSTRAINT ck_promo_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO hero_promo_settings (id) VALUES (1);

-- One-time password-reset codes emailed to an account. The code is stored
-- only as a scrypt hash; rate limiting/expiry are enforced in the app.
CREATE TABLE password_reset_otps (
  id          VARCHAR(64)  NOT NULL PRIMARY KEY,
  user_id     VARCHAR(64)  NOT NULL,
  code_hash   VARCHAR(255) NOT NULL,
  expires_at  DATETIME(3)  NOT NULL,
  attempts    INT          NOT NULL DEFAULT 0,
  consumed_at DATETIME(3)  NULL,
  created_at  DATETIME(3)  NOT NULL,
  INDEX idx_reset_user (user_id, created_at),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Platform SMTP settings (single row, id=1), editable by the Super Admin.
-- password_enc is AES-256-GCM encrypted at rest (see secretbox.ts) — never
-- stored or transmitted in the clear.
CREATE TABLE smtp_settings (
  id           TINYINT      NOT NULL PRIMARY KEY DEFAULT 1,
  host         VARCHAR(191) NOT NULL DEFAULT '',
  port         INT          NOT NULL DEFAULT 465,
  secure       BOOLEAN      NOT NULL DEFAULT TRUE,
  username     VARCHAR(191) NOT NULL DEFAULT '',
  password_enc TEXT         NULL,
  from_email   VARCHAR(191) NOT NULL DEFAULT '',
  from_name    VARCHAR(191) NOT NULL DEFAULT '',
  configured   BOOLEAN      NOT NULL DEFAULT FALSE,
  CONSTRAINT ck_smtp_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO smtp_settings (id) VALUES (1);

-- Single-row change counter. Clients poll GET /api/rpc and re-fetch their
-- subscriptions when this moves, so it must be shared across processes —
-- a per-process counter would leave other Passenger workers' clients stale.
CREATE TABLE data_revision (
  id  TINYINT NOT NULL PRIMARY KEY DEFAULT 1,
  rev BIGINT  NOT NULL DEFAULT 0,
  CONSTRAINT ck_revision_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO data_revision (id, rev) VALUES (1, 0);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- Hostel ERP — PostgreSQL database design
-- ============================================================================
-- Relational schema for the data model in lib/data/types.ts, written for the
-- day the localStorage mock (lib/data/mock/*) is replaced by a real backend.
-- The repository interfaces in lib/data/repository.ts are the seam: a real
-- implementation of those interfaces reads/writes THESE tables.
--
-- Conventions
--   * UUID primary keys (gen_random_uuid(), PostgreSQL 13+).
--   * snake_case column names map 1:1 to the camelCase fields in types.ts.
--   * "month" columns are CHAR(7) 'YYYY-MM' to match the app's month keys.
--   * TS string-union types become ENUMs; open-ended strings stay TEXT.
--   * Discriminated-union content tables (service listings, study abroad)
--     keep variant-specific fields in JSONB `attrs`.
--   * created_at/updated_at everywhere; updated_at maintained by trigger.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE user_role        AS ENUM ('student','manager','owner','cook','superadmin','marketing','service');
CREATE TYPE meal_slot        AS ENUM ('breakfast','lunch','dinner');
CREATE TYPE rotation_policy  AS ENUM ('spin-wheel','manual');
CREATE TYPE split_mode       AS ENUM ('fixed','equal');
CREATE TYPE bill_section_label AS ENUM ('mealCost','serviceCharge','roomRent','cookSalary');
CREATE TYPE bill_target      AS ENUM ('mealCost','serviceCharge','roomRent','cookSalary','previousBalance');
CREATE TYPE payment_method   AS ENUM ('bKash','Nagad','Card','Cash');
CREATE TYPE request_status   AS ENUM ('pending','approved','denied');
CREATE TYPE transfer_stage   AS ENUM ('requested','manager_review','owner_review','approved','denied');
CREATE TYPE swap_status      AS ENUM ('pending','accepted','denied','cancelled');
CREATE TYPE duty_type        AS ENUM ('shopping','cleaning');
CREATE TYPE cook_leave_scope AS ENUM ('full-day','partial');
CREATE TYPE attendance_status AS ENUM ('reported','confirmed_absent','resolved_cooked');
CREATE TYPE attendance_vote  AS ENUM ('yes','no','dk');
CREATE TYPE adjustment_kind  AS ENUM ('refund','transfer');
CREATE TYPE announcement_kind AS ENUM ('general','cook-absence-poll','cook-absence-resolved','cook-leave-approved','spin-wheel-cta','swap-request','swap-completed','swap-denied','shortage-alert','meal-edit-poll','meal-edit-resolved');
CREATE TYPE rating_target    AS ENUM ('menu','cook','manager');
CREATE TYPE order_status     AS ENUM ('placed','confirmed','delivered','cancelled');
CREATE TYPE product_kind     AS ENUM ('grocery','book');
CREATE TYPE book_condition   AS ENUM ('Like new','Good','Fair');
CREATE TYPE campaign_status  AS ENUM ('planned','running','done');
CREATE TYPE service_kind     AS ENUM ('cook','job','course','offer','hostel');
CREATE TYPE study_kind       AS ENUM ('country','scholarship','counsellor','blog','promo');
CREATE TYPE explore_feature  AS ENUM ('jobs','learning','books','offers','cooks','investment','studyabroad');
CREATE TYPE explore_action   AS ENUM ('applied','enrolled','saved','grabbed');
CREATE TYPE shortage_status  AS ENUM ('pending','resolved');

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Core: users, hostels, rooms
-- (users.hostel_id / hostels.manager_id are circular — FKs added afterwards)
-- ---------------------------------------------------------------------------

-- lib/data/types.ts:User. Owners/platform roles have hostel_id NULL (the mock
-- used a nominal fallback id; SQL makes non-membership explicit). The mock's
-- User.ownedHostelIds array is replaced by hostels.owner_id.
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role                user_role   NOT NULL,
  name                TEXT        NOT NULL,
  phone               TEXT        NOT NULL UNIQUE,      -- current sign-in credential
  email               TEXT,
  password_hash       TEXT,                             -- for real auth later (or use an auth provider)
  avatar_seed         TEXT        NOT NULL DEFAULT '',
  hostel_id           UUID,                             -- FK below; NULL for owner/platform
  room_id             UUID,                             -- FK below; NULL = unassigned
  student_id          TEXT,
  department          TEXT,
  meals_suspended     BOOLEAN     NOT NULL DEFAULT FALSE,
  banned              BOOLEAN     NOT NULL DEFAULT FALSE,
  manager_rating      SMALLINT    CHECK (manager_rating BETWEEN 1 AND 5),
  manager_rating_note TEXT,
  joined_at           DATE,
  -- Per-user notification opt-outs (types.ts User.notificationPrefs);
  -- missing key = enabled. {"announcements":bool,"bills":bool,"monthlyReport":bool}
  notification_prefs  JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- lib/data/types.ts:Hostel + HostelSettings flattened. managerPermissions and
-- meal cutoffs live in their own tables below.
CREATE TABLE hostels (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      TEXT        NOT NULL,
  area                      TEXT        NOT NULL,
  owner_id                  UUID        NOT NULL REFERENCES users(id),
  manager_id                UUID        REFERENCES users(id),
  cook_id                   UUID        REFERENCES users(id),
  meal_rate                 NUMERIC(10,2) NOT NULL,
  kitchen_location          TEXT,
  cook_monthly_salary       NUMERIC(10,2),
  suspended                 BOOLEAN     NOT NULL DEFAULT FALSE,
  -- settings
  guest_meal_price          NUMERIC(10,2) NOT NULL DEFAULT 0,
  meal_stop_requires_approval BOOLEAN   NOT NULL DEFAULT TRUE,
  shopping_rotation_policy  rotation_policy NOT NULL DEFAULT 'spin-wheel',
  service_charge_monthly    NUMERIC(10,2) NOT NULL DEFAULT 0,  -- owner-only flat charge
  offers_breakfast          BOOLEAN     NOT NULL DEFAULT TRUE, -- master meal on/off
  offers_lunch              BOOLEAN     NOT NULL DEFAULT TRUE,
  offers_dinner             BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rooms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id  UUID          NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  number     TEXT          NOT NULL,
  capacity   SMALLINT      NOT NULL CHECK (capacity > 0),
  seat_rent  NUMERIC(10,2) NOT NULL,   -- per seat, each occupant pays this
  facilities TEXT[]        NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (hostel_id, number)
);

ALTER TABLE users
  ADD CONSTRAINT users_hostel_fk FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE SET NULL,
  ADD CONSTRAINT users_room_fk   FOREIGN KEY (room_id)   REFERENCES rooms(id)   ON DELETE SET NULL;
-- Room occupancy = users.room_id (the mock's Room.occupantIds array inverted).
-- Enforce capacity in the API layer or a trigger; a plain constraint can't.

CREATE INDEX idx_users_hostel ON users(hostel_id);
CREATE INDEX idx_users_room   ON users(room_id);
CREATE INDEX idx_rooms_hostel ON rooms(hostel_id);

-- Owner-configurable manager permissions (types.ts:ManagerPermissions).
CREATE TABLE manager_permissions (
  hostel_id     UUID PRIMARY KEY REFERENCES hostels(id) ON DELETE CASCADE,
  rooms         BOOLEAN NOT NULL DEFAULT TRUE,
  members       BOOLEAN NOT NULL DEFAULT TRUE,
  approvals     BOOLEAN NOT NULL DEFAULT TRUE,
  finance       BOOLEAN NOT NULL DEFAULT TRUE,
  billing       BOOLEAN NOT NULL DEFAULT TRUE,
  menu          BOOLEAN NOT NULL DEFAULT TRUE,
  duties        BOOLEAN NOT NULL DEFAULT TRUE,
  announcements BOOLEAN NOT NULL DEFAULT TRUE
);

-- HostelSettings.mealCutoff rows.
CREATE TABLE hostel_meal_cutoffs (
  hostel_id   UUID      NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  meal        meal_slot NOT NULL,
  cutoff_time TIME      NOT NULL,
  PRIMARY KEY (hostel_id, meal)
);

-- ---------------------------------------------------------------------------
-- Meals, menus, ratings, comments
-- ---------------------------------------------------------------------------

-- types.ts:MealDay decomposed. One row per hostel/date holds day-level data
-- (shopping duty person); per-member/per-slot toggles live in meal_entries.
CREATE TABLE meal_days (
  hostel_id        UUID NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  shopping_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (hostel_id, date)
);

-- MealDay.entries[userId][slot]. Absence of a row = the app-level default
-- (on, when the hostel offers that slot) — mirror the mock's ensureMealEntry
-- semantics in the API layer, or materialize rows on first read.
CREATE TABLE meal_entries (
  hostel_id   UUID      NOT NULL,
  date        DATE      NOT NULL,
  user_id     UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal        meal_slot NOT NULL,
  is_on       BOOLEAN   NOT NULL DEFAULT TRUE,
  guest_count SMALLINT  NOT NULL DEFAULT 0 CHECK (guest_count >= 0),
  PRIMARY KEY (hostel_id, date, user_id, meal),
  FOREIGN KEY (hostel_id, date) REFERENCES meal_days(hostel_id, date) ON DELETE CASCADE
);
CREATE INDEX idx_meal_entries_user ON meal_entries(user_id, date);

-- types.ts:Menu — one row per hostel/date/slot.
CREATE TABLE menus (
  hostel_id UUID      NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  date      DATE      NOT NULL,
  meal      meal_slot NOT NULL,
  dishes    TEXT[]    NOT NULL DEFAULT '{}',
  PRIMARY KEY (hostel_id, date, meal)
);

-- types.ts:Rating — food (menu), cook, and manager ratings by members.
CREATE TABLE ratings (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID          NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  user_id   UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date      DATE          NOT NULL,
  meal      meal_slot     NOT NULL,
  target    rating_target NOT NULL,
  stars     SMALLINT      NOT NULL CHECK (stars BETWEEN 1 AND 5),
  UNIQUE (hostel_id, user_id, date, meal, target)   -- re-rating replaces
);
CREATE INDEX idx_ratings_hostel_date ON ratings(hostel_id, date);

CREATE TABLE comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id  UUID        NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       DATE        NOT NULL,
  text       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_hostel_date ON comments(hostel_id, date);

CREATE TABLE comment_reactions (
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  PRIMARY KEY (comment_id, user_id, emoji)
);

-- ---------------------------------------------------------------------------
-- Duties, shopping, shortages
-- ---------------------------------------------------------------------------

-- types.ts:DutyPlan. Blocks keep the mock's array shape (1-2 users, N dates)
-- as first-class rows.
CREATE TABLE duty_plans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id      UUID      NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  type           duty_type NOT NULL,
  requires_spin  BOOLEAN   NOT NULL DEFAULT FALSE,
  start_date     DATE      NOT NULL,
  end_date       DATE      NOT NULL,
  budget_per_day NUMERIC(10,2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_duty_plans_hostel ON duty_plans(hostel_id, end_date);

CREATE TABLE duty_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID   NOT NULL REFERENCES duty_plans(id) ON DELETE CASCADE,
  block_index SMALLINT NOT NULL,
  user_ids    UUID[] NOT NULL,    -- 1 (individual) or 2 (companion pair)
  dates       DATE[] NOT NULL,
  UNIQUE (plan_id, block_index)
);

-- DutyPlan.spun — who has spun the wheel.
CREATE TABLE duty_spins (
  plan_id UUID NOT NULL REFERENCES duty_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spun_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, user_id)
);

CREATE TABLE swap_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id    UUID        NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  plan_id      UUID        NOT NULL REFERENCES duty_plans(id) ON DELETE CASCADE,
  from_user_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       swap_status NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- types.ts:ShoppingCost — actual grocery spend by the duty person.
CREATE TABLE shopping_costs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id  UUID          NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  user_id    UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dates      DATE[]        NOT NULL,
  amount     NUMERIC(10,2) NOT NULL,
  items      TEXT,
  created_at TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_shopping_costs_hostel ON shopping_costs(hostel_id);

CREATE TABLE shortage_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id   UUID            NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  cook_id     UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  items       TEXT            NOT NULL,
  status      shortage_status NOT NULL DEFAULT 'pending',
  resolved_by UUID            REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Finance: expenses, bills, payments
-- ---------------------------------------------------------------------------

-- types.ts:Expense. category stays TEXT (open set: Utilities/Salary/Grocery/…).
CREATE TABLE expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id     UUID          NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  category      TEXT          NOT NULL,
  amount        NUMERIC(10,2) NOT NULL,  -- fixed: per member; equal: total
  split_mode    split_mode    NOT NULL,
  date_from     DATE          NOT NULL,
  date_to       DATE          NOT NULL,
  billing_month CHAR(7)       NOT NULL,  -- 'YYYY-MM' the expense is charged in
  note          TEXT,
  billed_at     TIMESTAMPTZ,             -- locked into a generated bill
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_hostel_month ON expenses(hostel_id, billing_month);

-- Expense.memberIds — which boarders the expense is split across.
CREATE TABLE expense_members (
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (expense_id, user_id)
);

-- types.ts:Bill. Sections/items are snapshots taken at generation time — bill
-- history must never change when meal rates or expenses are edited later.
CREATE TABLE bills (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id             UUID          NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  user_id               UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month                 CHAR(7)       NOT NULL,
  meals_count           INTEGER       NOT NULL DEFAULT 0,
  previous_balance      NUMERIC(10,2) NOT NULL DEFAULT 0,
  previous_balance_paid NUMERIC(10,2) NOT NULL DEFAULT 0,
  grand_total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid                  NUMERIC(10,2) NOT NULL DEFAULT 0,
  due_date              DATE,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (hostel_id, user_id, month)
);
CREATE INDEX idx_bills_hostel_month ON bills(hostel_id, month);

CREATE TABLE bill_sections (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id  UUID               NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  label    bill_section_label NOT NULL,
  total    NUMERIC(10,2)      NOT NULL DEFAULT 0,
  paid     NUMERIC(10,2)      NOT NULL DEFAULT 0,   -- per-section paid tracking
  UNIQUE (bill_id, label)
);

-- BillSection.items — named lines ("Monthly service charge (set by owner)",
-- "Utilities — Electricity bill share", "23 own meals", …). The monthly
-- report itemizes straight from these rows.
CREATE TABLE bill_line_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID          NOT NULL REFERENCES bill_sections(id) ON DELETE CASCADE,
  position   SMALLINT      NOT NULL DEFAULT 0,
  label      TEXT          NOT NULL,
  amount     NUMERIC(10,2) NOT NULL
);

-- types.ts:Payment.
CREATE TABLE payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id       UUID           NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  amount        NUMERIC(10,2)  NOT NULL,
  paid_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  method        payment_method NOT NULL,
  reference     TEXT,
  sender_number TEXT,
  verified      BOOLEAN        NOT NULL DEFAULT FALSE,
  targets       bill_target[]  NOT NULL DEFAULT '{}',
  breakdown     JSONB          -- exact split applied per target at payment time
);
CREATE INDEX idx_payments_bill ON payments(bill_id);

-- types.ts:BillAdjustment — settling a member's meal-cost credit.
CREATE TABLE bill_adjustments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id    UUID            NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  user_id    UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount     NUMERIC(10,2)   NOT NULL,
  kind       adjustment_kind NOT NULL,
  from_part  bill_target     NOT NULL,
  to_part    bill_target,
  note       TEXT,
  created_at TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Requests & workflows
-- ---------------------------------------------------------------------------

CREATE TABLE cook_leave_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id  UUID             NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  cook_id    UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_from  DATE             NOT NULL,
  date_to    DATE             NOT NULL,
  scope      cook_leave_scope NOT NULL,
  meals      meal_slot[],               -- when scope = 'partial'
  reason     TEXT             NOT NULL,
  status     request_status   NOT NULL DEFAULT 'pending',
  decided_by UUID             REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE TABLE cook_attendance_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id   UUID              NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  date        DATE              NOT NULL,
  meal        meal_slot         NOT NULL,
  status      attendance_status NOT NULL DEFAULT 'reported',
  reported_by UUID              NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT now(),
  UNIQUE (hostel_id, date, meal)
);

CREATE TABLE cook_attendance_votes (
  report_id UUID            NOT NULL REFERENCES cook_attendance_reports(id) ON DELETE CASCADE,
  user_id   UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  choice    attendance_vote NOT NULL,
  voted_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, user_id)
);

CREATE TABLE meal_edit_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id      UUID           NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  target_user_id UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date           DATE           NOT NULL,
  reason         TEXT           NOT NULL,
  requested_by   UUID           NOT NULL REFERENCES users(id),
  status         request_status NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE TABLE meal_edit_votes (
  request_id UUID        NOT NULL REFERENCES meal_edit_requests(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  choice     TEXT        NOT NULL CHECK (choice IN ('yes','no')),
  voted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, user_id)
);

CREATE TABLE join_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id  UUID           NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  name       TEXT           NOT NULL,
  phone      TEXT           NOT NULL,
  -- Set for account-linked requests (the find-hostel / QR flow): approval
  -- attaches THIS user to the hostel instead of creating a new one.
  user_id    UUID           REFERENCES users(id) ON DELETE CASCADE,
  status     request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX idx_join_requests_user ON join_requests(user_id);

CREATE TABLE transfer_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_hostel_id UUID           NOT NULL REFERENCES hostels(id),
  to_hostel_id   UUID           NOT NULL REFERENCES hostels(id),
  reason         TEXT           NOT NULL,
  stage          transfer_stage NOT NULL DEFAULT 'requested',
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- HostelTransferRequest.timeline rows.
CREATE TABLE transfer_timeline (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID        NOT NULL REFERENCES transfer_requests(id) ON DELETE CASCADE,
  stage       TEXT        NOT NULL,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  by_user_id  UUID        REFERENCES users(id)
);

CREATE TABLE meal_stop_requests (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID           NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  user_id   UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meals     meal_slot[]    NOT NULL,
  date_from DATE           NOT NULL,
  date_to   DATE           NOT NULL,
  reason    TEXT,
  status    request_status NOT NULL DEFAULT 'pending'
);

CREATE TABLE guest_meal_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id  UUID           NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  user_id    UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal       meal_slot      NOT NULL,
  date       DATE           NOT NULL,
  guest_name TEXT           NOT NULL,
  qty        SMALLINT       NOT NULL CHECK (qty > 0),
  status     request_status NOT NULL DEFAULT 'pending'
);

-- ---------------------------------------------------------------------------
-- Announcements & notifications
-- ---------------------------------------------------------------------------

CREATE TABLE announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id  UUID              NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  kind       announcement_kind NOT NULL DEFAULT 'general',
  title      TEXT              NOT NULL,
  body       TEXT              NOT NULL,
  payload    JSONB,
  created_at TIMESTAMPTZ       NOT NULL DEFAULT now()
);
CREATE INDEX idx_announcements_hostel ON announcements(hostel_id, created_at DESC);

-- types.ts:ActivityLog — the owner's audit trail of hostel actions (expenses,
-- bills, bans, rooms, settings, master meal switches, staff changes). In the
-- real backend the actor comes from the auth token, not client state.
CREATE TABLE activity_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id  UUID        NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  actor_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT        NOT NULL,   -- snapshot, survives account removal
  action     TEXT        NOT NULL,
  detail     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_logs_hostel ON activity_logs(hostel_id, created_at DESC);

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  announcement_id UUID        REFERENCES announcements(id) ON DELETE SET NULL,
  title           TEXT        NOT NULL,
  body            TEXT        NOT NULL,
  read            BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
-- The month-end "generate your monthly report" reminder becomes a scheduled
-- job (pg_cron / external cron) inserting one row per user, deduped on
-- (user_id, title) per month — same rule the client module uses today.

-- ---------------------------------------------------------------------------
-- Platform: explore, community, catalog, marketing
-- ---------------------------------------------------------------------------

CREATE TABLE explore_interactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature    explore_feature NOT NULL,
  item_id    TEXT            NOT NULL,   -- stable id from lib/explore/content.ts
  kind       explore_action  NOT NULL,
  created_at TIMESTAMPTZ     NOT NULL DEFAULT now(),
  UNIQUE (user_id, feature, item_id, kind)
);

CREATE TABLE community_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id   UUID        NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_name TEXT        NOT NULL,     -- snapshot, like the mock
  body        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE community_post_likes (
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

-- types.ts:ServiceListing (discriminated union) — shared columns + JSONB attrs
-- for the per-kind fields (cook: cuisine/experienceYears/…, job: company/…).
CREATE TABLE service_listings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       service_kind NOT NULL,
  active     BOOLEAN      NOT NULL DEFAULT TRUE,
  attrs      JSONB        NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_listings_kind ON service_listings(kind) WHERE active;

CREATE TABLE campaigns (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT            NOT NULL,
  channel    TEXT            NOT NULL,
  status     campaign_status NOT NULL DEFAULT 'planned',
  start_date DATE            NOT NULL,
  budget     NUMERIC(12,2)   NOT NULL DEFAULT 0,
  note       TEXT
);

CREATE TABLE marketing_targets (
  metric TEXT    NOT NULL,
  month  CHAR(7) NOT NULL,
  target NUMERIC(14,2) NOT NULL,
  PRIMARY KEY (metric, month)
);

-- ---------------------------------------------------------------------------
-- E-commerce (grocery + books store)
-- ---------------------------------------------------------------------------

CREATE TABLE products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           product_kind  NOT NULL,
  name           TEXT          NOT NULL,
  price          NUMERIC(10,2) NOT NULL,
  category       TEXT          NOT NULL,
  image_url      TEXT,          -- object storage URL (mock stored data URLs)
  active         BOOLEAN       NOT NULL DEFAULT TRUE,
  unit           TEXT,          -- grocery only
  author         TEXT,          -- book only
  academic_class TEXT,          -- book only
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID     NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty        SMALLINT NOT NULL CHECK (qty > 0),
  UNIQUE (user_id, product_id)
);

CREATE TABLE orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID           NOT NULL REFERENCES users(id),
  hostel_id      UUID           REFERENCES hostels(id),
  subtotal       NUMERIC(10,2)  NOT NULL,
  delivery_fee   NUMERIC(10,2)  NOT NULL DEFAULT 0,
  total          NUMERIC(10,2)  NOT NULL,
  payment_method payment_method NOT NULL,
  status         order_status   NOT NULL DEFAULT 'placed',
  note           TEXT,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);

-- Order lines are price/name SNAPSHOTS — catalog edits never rewrite history.
CREATE TABLE order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID          REFERENCES products(id) ON DELETE SET NULL,
  kind       product_kind  NOT NULL,
  name       TEXT          NOT NULL,
  qty        SMALLINT      NOT NULL,
  price      NUMERIC(10,2) NOT NULL
);

CREATE TABLE used_book_listings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id      UUID           NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  seller_id      UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_name    TEXT           NOT NULL,
  title          TEXT           NOT NULL,
  author         TEXT           NOT NULL,
  category       TEXT           NOT NULL,
  academic_class TEXT           NOT NULL,
  condition      book_condition NOT NULL,
  price          NUMERIC(10,2)  NOT NULL DEFAULT 0,
  free           BOOLEAN        NOT NULL DEFAULT FALSE,
  phone          TEXT           NOT NULL,
  image_url      TEXT,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Study abroad hub
-- ---------------------------------------------------------------------------

-- types.ts:StudyAbroadItem (discriminated union) — JSONB attrs per kind.
CREATE TABLE study_abroad_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       study_kind  NOT NULL,
  active     BOOLEAN     NOT NULL DEFAULT TRUE,
  attrs      JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE study_leads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT        NOT NULL,
  phone              TEXT        NOT NULL,
  email              TEXT        NOT NULL,
  interested_country TEXT        NOT NULL,
  last_academic      TEXT        NOT NULL,
  english_test       TEXT        NOT NULL,
  subjects           TEXT        NOT NULL,
  contacted          BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Singleton row (enforced by the CHECK) — types.ts:HeroPromoSettings.
CREATE TABLE hero_promo_settings (
  id       BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  settings JSONB NOT NULL DEFAULT '{}'
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','hostels','rooms','bills','orders'] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

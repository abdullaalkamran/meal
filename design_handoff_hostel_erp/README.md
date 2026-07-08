# Handoff: Student Hostel ERP — Multi-User Web App

## Overview
A hostel/mess management system for students and managers. Members control their daily meals (ON/OFF per meal), view menus, rate food and the cook, see bills, and take part in fair duty rotations (shopping/cleaning) assigned by a spin wheel. A manager (any member the owner promotes) oversees meal adjustments, approvals, duty planning, announcements, rooms, and cook attendance. The goal of this handoff is to rebuild this as a **real multi-user web application** with accounts, a shared database, and live updates.

## About the Design Files
The file in this bundle (`Hostel ERP Prototype.dc.html`) is a **design reference created in HTML** — a high-fidelity interactive prototype showing intended look and behavior. It is NOT production code to copy. All data in it is simulated in-browser for a single device. The task is to **recreate these designs in a real web stack** using the team's established patterns — if no stack exists yet, a sensible default is **React (Next.js) + Supabase or Firebase** (auth, Postgres/Firestore, realtime subscriptions), which covers every multi-user requirement below without running custom servers.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and interactions are final. Recreate the UI pixel-perfectly.

## Roles
- **Student (member)** — default role.
- **Manager** — a member with an assigned role (the hostel owner can promote/demote anyone). Same app, extra screens/actions.
- The prototype has a role switcher at the top for demo purposes only; the real app derives role from the logged-in account.

## Screens / Views

### 1. Student Home
- **Hero card** (gradient, 22px radius): greeting, date, and **My Meal status indicator** — "ON" / "OFF" (display only, NOT a button; status is derived from the member's meal settings and requests).
- **Today's meals** strip: Breakfast / Lunch / Dinner rows with the member's own ON/OFF status per meal.
- Quick links: Meals, Menu, Shopping, Bills.
- Announcements feed (see Announcements).

### 2. Meals Page
- **Full month calendar at top** — acts as a global filter for all data below. Advanced month/year picker (segmented month chips + year stepper).
- Selected date shows:
  - **All members list (expandable as a whole, not per-member)** with each member's B/L/D ON/OFF status; guest meals shown as "+N guest" chips and counted into that member's total.
  - **Day total of ON meals** (border count) prominently.
  - **Responsible shopping person** and **manager name** for the selected date.
- **My meal toggles** per meal per date (the only thing a member can change), plus guest-meal add.
- Meal counts are otherwise **not manually adjustable** — they derive from ON/OFF states, requests, and cook-absence outcomes.

### 3. Today's Menu / Menu Details
- Today's menu shows all **3 meals of the day** (Breakfast, Lunch, Dinner) with dishes.
- **Menu details page** (opens as its own page with back button):
  - Calendar-wise browsing.
  - **Rating system per individual meal** (Breakfast/Lunch/Dinner separately) for both the **menu** and the **cook** (1–5 stars).
  - **Comments** with an emoji reaction system: users pick any emoji from a picker (not a fixed set) to react to others' comments.
  - Shows responsible shopping person + manager name & phone for the selected date.

### 4. Shopping Duty Page (member)
- **Spin wheel** (SVG donut, dark card): after the manager creates a rotation plan, each included member spins once to reveal their **consecutive block of dates** (e.g. "2–4 Jul"). Wheel: gapped donut segments in palette `#7C6CF6 #4CC9F0 #34D399 #FBBF24 #F472B6 #60A5FA #F87171 #2DD4BF`, upright labels, white needle, dark tap-to-spin hub, 3.3s ease-out spin (6 turns).
- After spinning: **"Your shopping duty"** result card (teal gradient) with assigned dates.
- **Swap requests**: a member with dates can request a swap with any other member's block. The receiver (announcement) can **Accept** (dates exchange everywhere) or **Deny**. After a completed swap, further changes require a new swap request. Pending requests show a banner with Cancel.
- **Shopping cost input**: the duty holder submits their actual shopping cost for their duty date(s) (budget shown, e.g. ৳2,500/day).

### 5. Bills Page
- Three sections: **Meal cost**, **Service charge**, **Room rent** — each itemized, with a grand total. Month/year filter applies.

### 6. My Requests
- Member's requests (meal changes, leaves, etc.), each **tap-to-expand** for details and status (pending/approved/denied).

### 7. Manager Dashboard
- Hero with manager identity; below it, **cook leave requests** (full-day or per-meal) with approve/deny. Approving broadcasts an announcement to all members.
- **Quick actions**: set shopping duty, set cleaning duty, rooms overview (total/occupied/empty), assign member to room, approve new members / add member via QR scan.
- **Meal section** mirroring the member meal overview (all members, all dates) for oversight.

### 8. Manager — Duty Rotation (Shopping & Cleaning)
- **Member selection** with checkboxes + "select all".
- **Calendar range picker** (tap start, tap end; month tabs e.g. Jul/Aug) so rotations can be planned before the month starts.
- Creating a plan splits the range into **equal consecutive blocks** (2–4 days each typical), randomly ordered among selected members, and posts a **"Spin the wheel"** announcement to all included members.
- Plan preview lists each member, their block, and whether they've spun.
- Cleaning duty uses the same equal-days rotation model (days-per-member spinner).

### 9. Manager — Meal Adjustment / Cook Attendance
- Per meal (B/L/D) per day the manager marks **Cooked** or **Reported not cooked** (cook may be absent without notice).
- Reporting sends a **poll announcement** to all members: "Was lunch cooked today?" with three votes — **No · not cooked / Yes · cooked / Don't know**. Live tally is shown to the manager.
- The **manager confirms** based on votes; confirming marks that meal **OFF for everyone** (count 0) and updates the announcement to "Meal cancelled — cook absent".

### 10. Approvals Page (manager)
- Apple-style grouped list of pending items (member requests, join requests) with approve/deny.

### 11. Announcements
- Feed shown to all members. Kinds: general, cook-absence poll (3-way vote), cook-leave approved notice, spin-the-wheel call-to-action (deep-links to Shopping), swap request (Accept/Deny buttons), swap completed.

## Interactions & Behavior
- Toast notifications (bottom, pill) confirm every action.
- Sheets/modals slide up (mobile-first, ~390px design width).
- Spin wheel: `transform: rotate()` with `transition: transform 3.3s cubic-bezier(.15,.68,.14,1)`; result lands the member's segment under the top needle.
- Calendar range selection: first tap sets start, second tap sets end; range highlights.
- Expand/collapse: member list and requests use tap-to-expand with chevron rotation.

## State Management / Data Model (server-side)
Entities:
- **User** (id, name, phone, role: member|manager|owner, roomId)
- **Room** (number, capacity, occupants)
- **MealDay** (date → per-user per-meal ON/OFF, guest counts)
- **Menu** (date, meal, dishes)
- **Rating** (userId, date, meal, target: menu|cook, stars)
- **Comment** (userId, date, text) + **Reaction** (commentId, userId, emoji — any emoji)
- **DutyPlan** (type: shopping|cleaning, startDate, endDate, memberIds, blocks: {userId, dates[]}, spun: {userId: bool})
- **SwapRequest** (fromUserId, toUserId, status: pending|accepted|denied|cancelled)
- **ShoppingCost** (userId, dates, amount)
- **Bill** (userId, month, mealCost, serviceCharge, roomRent)
- **CookLeaveRequest** (date, meals[], status)
- **CookAttendance** (date, meal, status: cooked|reported|confirmed_absent) + **Poll votes** (userId, vote: yes|no|dk)
- **Announcement** (kind, payload, createdAt)

Multi-user rules:
- Meal ON/OFF cutoff times should be configurable (e.g. lock breakfast changes after 9pm previous day).
- All lists (meals, tallies, announcements, swaps) must update in **realtime** across devices (Supabase Realtime / Firestore listeners).
- Role checks server-side: only managers can create plans, confirm cook absence, approve requests.
- One spin per member per plan; swap changes must be transactional (both blocks exchange atomically).

## Design Tokens
- Background `#F5F6F8`, card `#FFFFFF`, border `#E8EAEE`, text `#1A1D26`, secondary `#7A8194`
- Primary teal `#10BFB4` (soft `#E0F7F5`), blue `#4C7DF0` (soft `#EAF0FE`), orange `#F59E0B` (soft `#FEF3E2`), danger `#EF4444` (soft `#FEECEC`)
- Hero/dark cards: navy gradient `#181C2E → #232946`; accent gradient `#7C6CF6 → #4CC9F0`
- Radius: cards 20–22px, buttons 12–14px, chips 999px; shadows soft (`0 8px 24px -12px rgba(...)`)
- Type: system font stack (SF-style), weights 500/700/800, tight letter-spacing (−0.01 to −0.03em); currency ৳ (BDT)
- Min hit target 44px.

## Assets
No external images. All icons are inline SVG (Feather-style, 2px stroke). Spin wheel is inline SVG.

## Files
- `Hostel ERP Prototype.dc.html` — the complete interactive prototype (all roles and screens; use the top role switcher to demo Student vs Manager).

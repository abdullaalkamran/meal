# Database design (PostgreSQL)

`schema.sql` is the relational design for taking this app from the localStorage
mock to a real multi-user backend. It mirrors the TypeScript data model in
[`lib/data/types.ts`](../lib/data/types.ts) table-for-type, so the repository
interfaces in [`lib/data/repository.ts`](../lib/data/repository.ts) can be
re-implemented against it without touching any UI code — that seam was the
point of the `repo` layer from day one.

## How to run it

```bash
createdb hostel_erp
psql -d hostel_erp -f db/schema.sql
```

Works on PostgreSQL 13+ (needs `gen_random_uuid()`), including hosted
Postgres like Supabase, Neon, Railway, or RDS.

## Design decisions worth knowing

| Mock (localStorage) | Database | Why |
|---|---|---|
| `User.ownedHostelIds: string[]` | `hostels.owner_id` FK | one owner per hostel; the array inverted into a proper FK |
| `Room.occupantIds: string[]` | `users.room_id` FK | occupancy inverted; capacity enforced in the API layer |
| `MealDay.entries[userId][slot]` | `meal_days` + `meal_entries` rows | per-slot rows make counting/billing plain SQL aggregates |
| `HostelSettings` nested object | flattened columns + `manager_permissions` + `hostel_meal_cutoffs` tables | queryable settings, per-slot cutoffs |
| `mealsOffered` per slot | `offers_breakfast/lunch/dinner` booleans | the master meal on/off feature |
| Bill `sections[].items[]` | `bill_sections` + `bill_line_items` | bills stay immutable snapshots; the monthly report itemizes from these rows |
| Discriminated unions (`ServiceListing`, `StudyAbroadItem`) | `kind` enum + `attrs JSONB` | one table per catalog, open variant fields |
| Data-URL images on products/books | `image_url TEXT` | store files in object storage (S3/Supabase Storage), keep URLs in the DB |
| Phone-only demo sign-in | `users.phone UNIQUE` + `password_hash` column | ready for real credentials or an auth provider (Supabase Auth/NextAuth) — then `password_hash` stays NULL and the provider's user id gets a column |
| Month-end report notification (client-side check) | scheduled job (pg_cron or external cron) inserting `notifications` rows | servers have real clocks; dedupe on (user, title) per month like the client does |

## App-level rules the schema expects the API to enforce

These match the mock's behavior and are business logic, not constraints:

- **Meal entry defaults**: a missing `meal_entries` row means "on, if the
  hostel offers that slot" (`ensureMealEntry` semantics).
- **Master meal close**: closing a slot flips `offers_*` AND turns the slot
  off in `meal_entries` for dates >= today only — history untouched.
- **Room capacity**: reject assignment when a room's occupant count
  (`users.room_id`) reaches `rooms.capacity`.
- **Bill regeneration**: replace sections/items for the month but carry
  forward `paid` per section and lock included expenses (`billed_at`).
- **Owner-only fields**: `service_charge_monthly` and `manager_permissions`
  writable only by the hostel's owner; check `hostels.owner_id` server-side.
- **Manager permission flags** gate manager actions server-side, mirroring
  `hasManagerPermission` (owners always pass).

## Migration path from the mock

1. Stand up Postgres and run `schema.sql`.
2. Build a real `Repositories` implementation (e.g. `lib/data/pg/…` behind
   API routes, or Supabase client calls) satisfying `lib/data/repository.ts`.
3. Swap the export in [`lib/data/index.ts`](../lib/data/index.ts) — the single
   line `export const repo: Repositories = mockRepositories`.
4. Port `lib/data/mock/seed.ts` to SQL INSERTs for demo data if wanted.
5. Replace the client-side month-end notice (`lib/reports/monthEndNotice.ts`)
   with a scheduled job.

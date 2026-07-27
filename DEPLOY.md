# Deploying MyDorm

This app is a **long-lived Node server** (custom `server.js`, not the plain
`next start` CLI) so it can run under **Phusion Passenger**, which is what
Spaceship Shared Hosting (and cPanel/CloudLinux generally) uses via its
**Node.js Selector**. It stores data in a single JSON file on disk
(`lib/data/server/db.ts`), served through the `/api/rpc` route — no database
server required, just a writable, persistent directory, which shared hosting
gives you by default.

## Deploying on Spaceship Shared Hosting (CloudLinux Node.js Selector)

1. **Upload the project** to your hosting account (Git Version Control, SFTP,
   or the File Manager) — anywhere outside `public_html`, e.g.
   `~/hostel-erp`.

2. **Setup Node App** (cPanel → "Setup Node.js App" → Create Application):
   - **Node.js version**: pick **20.x or newer** (this app requires Node
     `>=20.9.0` — see `engines` in `package.json`).
   - **Application mode**: Production
   - **Application root**: the folder you uploaded (e.g. `hostel-erp`)
   - **Application URL**: your domain/subdomain
   - **Application startup file**: `server.js` — **do not change this**, it's
     the Passenger entry point and is required to stay `server.js`.
   - Click **Create**. CloudLinux provisions `node_modules` as a **symlink**
     into a version-specific virtual environment outside the project root —
     this is normal and the app is set up to handle it (see below).

3. **Set environment variables** in the same Node App screen ("Environment
   Variables" section — do **not** rely on a committed `.env` file):

   ```
   AUTH_SECRET=<a long random string, e.g. `openssl rand -base64 32`>
   HOSTEL_DATA_DIR=/home/<cpanel-user>/hostel-erp-data
   NODE_ENV=production
   ```

   `HOSTEL_DATA_DIR` should point **outside** the application root so the
   database file survives redeploys that replace the app folder. Create that
   directory once via File Manager/SSH; the app creates `db.json` inside it
   on first write.

4. **Install dependencies**: use the "Run NPM Install" button in the Node App
   screen (this runs `npm install` inside the CloudLinux-managed virtualenv
   that owns the `node_modules` symlink — installing manually with a
   different Node/npm won't populate the same location).

5. **Build the app**. Open the "Run NPM Script" / terminal Passenger gives you
   (or SSH in and `source` the app's virtualenv `bin/activate` it prints on
   the Node App page) and run:

   ```bash
   npm run build
   ```

   This runs `next build --webpack`, **not** the default Turbopack build —
   see [Why `--webpack`](#why---webpack) below for why that matters here.

6. **Start / restart the app**: use the "Restart" button on the Node App
   page (this is equivalent to `touch tmp/restart.txt`, which Passenger
   watches). Passenger then launches `server.js` directly — there is no
   separate `start` step to run yourself in production.

7. Visit your domain. `GET /api/rpc` should return
   `{"persistent": true, ...}` — if `persistent` is `false`,
   `HOSTEL_DATA_DIR` isn't writable; check the path and permissions.

### Redeploying

After pulling new code (Git Version Control's "Pull" button, or re-uploading):

```bash
npm install     # only if dependencies changed
npm run build   # always — rebuilds .next
```

Then hit **Restart** in the Node App screen. Because `HOSTEL_DATA_DIR` lives
outside the application root, `db.json` is untouched by this.

## Why `--webpack`

Next.js 16 defaults `next build` to **Turbopack**. CloudLinux's Node.js
Selector provisions each app's `node_modules` as a **symlink** into a
separate, version-pinned virtual environment directory that sits outside the
project root (so switching Node versions or reinstalling doesn't touch your
uploaded code). Turbopack's build step resolves symlinks against the
filesystem root and refuses to follow one that points outside the project,
failing with:

```
Error [TurbopackInternalError]: Symlink [project]/node_modules is invalid,
it points out of the filesystem root
```

Webpack has no such restriction and resolves the symlinked packages
normally. The fix is entirely in `package.json`:

```json
"build": "next build --webpack"
```

No other code changes are needed to work around this — it's the officially
documented escape hatch for platforms where Turbopack's assumptions about the
filesystem don't hold (see `next build --webpack` / `next dev --webpack` in
the Next.js docs). `next dev` is left on Turbopack since local development
doesn't go through the CloudLinux symlink.

## Why build tools live in `dependencies`, not `devDependencies`

Deployments here may install **production dependencies only** — npm omits
`devDependencies` whenever `NODE_ENV=production` (which the Node App screen
sets), and `npm ci --omit=dev` does the same. Anything `next build` needs must
therefore be a regular dependency, or the build fails on the server while
working fine locally.

So `package.json` keeps these in `dependencies`:

- **`typescript`** + **`@types/node`**, **`@types/react`**, **`@types/react-dom`**,
  **`@types/qrcode`** — `next build` type-checks the project (and `next.config.ts`
  is itself TypeScript), so a missing compiler or missing type packages is a
  build error, not a warning.
- **`tailwindcss`** + **`@tailwindcss/postcss`** — `postcss.config.mjs` runs every
  stylesheet through Tailwind's PostCSS plugin during the build.

Only **`eslint`** and **`eslint-config-next`** remain in `devDependencies`:
Next.js 16 removed the `next lint` command and no longer runs ESLint as part of
`next build`, so linting (`npm run lint`) is purely a local/CI concern.

Verified by installing with `npm ci --omit=dev` and running
`NODE_ENV=production npm run build` — it completes, type-checks, and emits
compiled CSS with no devDependencies present.

## Why a custom `server.js` instead of `next start`

Passenger's Node.js integration works by spawning your **startup file**
directly and expecting it to start an HTTP server listening on the port (or
Unix socket path) Passenger hands it via `process.env.PORT` — it does not run
arbitrary `npm` scripts as the long-running process. `next start` is a CLI
wrapper Passenger can't invoke this way, so `server.js` calls the same
`next()` programmatic API `next start` uses internally, listens on
`process.env.PORT`, and must remain the configured **Application startup
file**. `npm start` (`NODE_ENV=production node server.js`) reproduces this
locally if you want to sanity-check a production build before deploying;
`npm run start:next` remains available for plain VPS/non-Passenger hosts.

## Making data survive restarts and redeploys

Shared hosting gives you a persistent disk by default (unlike Railway,
Render, or Fly's ephemeral containers), so no volume/mount step is required —
just point `HOSTEL_DATA_DIR` at a directory **outside** the application root
(step 3 above) so a redeploy that replaces the app folder doesn't wipe it.

If `HOSTEL_DATA_DIR` is unset or unwritable, the app still runs, but from
memory only: data resets on every restart and a warning is logged
(`Could not write the database…`). Check `GET /api/rpc` —
`"persistent": false` means writes aren't landing on disk.

## Database: MySQL

The app stores everything in **MySQL** (`db/schema.mysql.sql`, 61 tables). It
creates the schema itself on first start, so there is nothing to import by
hand.

1. **cPanel → MySQL® Databases**: create a database and a user, then **add the
   user to the database with ALL PRIVILEGES**.
2. Add these to the Node.js App screen's environment variables:

   ```
   MYSQL_HOST=localhost
   MYSQL_DATABASE=your_db_name
   MYSQL_USER=your_db_user
   MYSQL_PASSWORD=your_db_password
   ```

3. **Restart** the app. On first start it creates all tables and logs
   `MySQL schema created.`

Check it worked: `GET /api/rpc` returns `"backend": "mysql"`. If it says
`"json"`, the MySQL variables aren't set and the app fell back to the local
JSON file store.

### The admin account

Sign-in is by phone number, so admin phone numbers are **not** committed to the
repo — they'd be published credentials. The platform accounts are created from
environment variables on first start:

```
SUPERADMIN_PHONE=01xxxxxxxxx     # required, or the admin screens are unreachable
SUPERADMIN_NAME=Your Name
MARKETING_PHONE=01xxxxxxxxx      # optional
SERVICE_PHONE=01xxxxxxxxx        # optional
```

These are only created if that role doesn't exist yet, so restarts never
duplicate them. Everyone else signs up through the app: the first person
registers as a **hostel owner** and creates their hostel.

> The database ships **empty** — no demo hostels, members, meals or products.

### Why MySQL rather than the JSON file

Passenger can run more than one process. Two processes writing the same JSON
file overwrite each other's changes, silently losing data. MySQL runs every
multi-step change (approve a join request → move the member → free the old seat
→ notify) in a **transaction**, so it either lands completely or not at all.

## Set a session secret (auth)

Login issues a **signed httpOnly session cookie**. Set a long random secret so
those cookies can't be forged:

```
AUTH_SECRET=<a long random string, e.g. `openssl rand -base64 32`>
```

Without it the app still runs but uses an insecure built-in fallback and logs
a warning. Sessions also set the cookie `Secure` only over HTTPS, so login
works over plain HTTP before you attach a domain, and hardens automatically
once HTTPS is on.

`AUTH_SECRET` is **also** the key that encrypts the stored SMTP password (see
below). Set it once and keep it stable — rotating it invalidates every session
**and** makes the saved SMTP password unreadable (you'd re-enter it).

## Email / password reset (SMTP)

The **forgot-password** flow emails a 6-digit code. That needs an outgoing mail
(SMTP) account. There are two ways to configure it; the database wins over env.

**Option A — Super Admin UI (recommended).** Sign in as the Super Admin →
**Email (SMTP) settings** → fill in host, port, username, password, from
address → **Save**, then **Send a test email** to confirm. The password is
encrypted at rest (AES-256-GCM, keyed off `AUTH_SECRET`) and never sent back to
the browser. Nothing sensitive is committed to the repo.

**Option B — environment variables** (used only when nothing is saved in the
database):

```
SMTP_HOST=mail.spacemail.com
SMTP_PORT=465
SMTP_SECURE=true            # true = SSL (465); false = STARTTLS (587)
SMTP_USER=noreply@yourdomain
SMTP_PASS=<mailbox password>
MAIL_FROM_EMAIL=noreply@yourdomain   # defaults to SMTP_USER
MAIL_FROM_NAME=MyDorm
```

Do **not** put a real `SMTP_PASS` in any file that gets committed — set it in
the CloudLinux **Environment variables** panel (or use Option A).

If **no** SMTP is configured at all, reset still works for testing: set
`OTP_DEV_MODE=true` and the request endpoint returns the code in its JSON
response (and logs it) instead of emailing it. Leave this **off** in
production. Rate limits: 5 codes/hour per account, 60-second resend cooldown,
codes expire in 10 minutes, 5 verify attempts each.

## Browser push notifications (Web Push)

Every in-app notification is **also** pushed to the user's browser, so it
arrives even when the app/tab is closed. This needs **VAPID keys** — generate a
pair once and set them as environment variables:

```
npx web-push generate-vapid-keys
```

```
VAPID_PUBLIC_KEY=<the printed public key>
VAPID_PRIVATE_KEY=<the printed private key>   # SECRET — never commit
VAPID_SUBJECT=mailto:you@yourdomain            # optional, defaults to a mailto
```

Set these in the CloudLinux **Environment variables** panel and **restart** the
app. Until they're set, push is silently disabled (in-app notifications still
work). The public key is served to the browser at runtime, so rotating keys is
just "change env + restart" — no rebuild. The private key must never live in a
committed file.

Platform reality (browser Web Push, not the app's doing):
- **Desktop** Chrome/Edge/Firefox deliver while the browser runs in the
  background; a fully-quit browser with no background process can't be woken.
- **Android** Chrome delivers in the background.
- **iOS/iPadOS** (16.4+) deliver **only** when the site is installed to the Home
  Screen as a PWA (Share → Add to Home Screen) — the manifest + icons for that
  ship in `public/`.
- Requires **HTTPS** (AutoSSL covers this); `localhost` is exempt for testing.

## What this app deliberately does NOT use

To stay compatible with Passenger/shared hosting, this app avoids:

- **Docker** — no `Dockerfile`, no container runtime available or needed.
- **`output: "standalone"`** — this mode is explicitly incompatible with a
  custom `server.js` (Next.js traces a *different*, minimal server instead of
  using yours), so `next.config.ts` leaves `output` unset. The full
  `node_modules` (via the CloudLinux symlink) is what `server.js` runs
  against.
- **Vercel/Railway-only primitives** — Edge Runtime routes, ISR relying on a
  multi-instance shared cache. A single Passenger process on local disk is
  the deployment target.

## New features not showing after a deploy?

The code is client-rendered React, so if a deploy is serving old UI it's a
build/pipeline issue, not the app:

- Confirm you pulled/uploaded the **latest commit** before running
  `npm run build`.
- Delete `.next/` and rebuild if you suspect a stale build cache.
- Hard-refresh the browser (Ctrl/Cmd+Shift+R) to bypass cached assets.
- Confirm you clicked **Restart** in the Node App screen after building —
  Passenger keeps the old process running otherwise.

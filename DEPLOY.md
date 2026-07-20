# Deploying Hostel ERP

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

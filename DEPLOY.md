# Deploying Hostel ERP

The app currently stores all data in a single JSON file on the server
(`lib/data/server/db.ts`), served through the `/api/rpc` route. This works
anywhere it can run as a **long-lived Node server with a writable, persistent
disk** — a VPS, or Railway/Render/Fly with a mounted volume.

## Build & run

```bash
npm install
npm run build
npm start          # runs `next start` on $PORT (default 3000)
```

## Making data survive restarts (important)

Hosts like **Railway, Render, and Fly** give each deploy a **fresh, ephemeral
filesystem** — anything written under the app directory is wiped on the next
deploy or restart, and is sometimes read-only. So by default the data resets.

To keep data:

1. **Add a persistent volume/disk** in the host's dashboard and mount it at a
   path, e.g. `/data`.
   - Railway: Service → Variables/Volumes → add a Volume, mount path `/data`.
   - Render: Service → Disks → add a Disk, mount path `/data`.
2. **Set an environment variable** so the app writes there:

   ```
   HOSTEL_DATA_DIR=/data
   ```

That's it — the database file becomes `/data/db.json` and survives redeploys.

## Set a session secret (auth)

Login issues a **signed httpOnly session cookie**. Set a long random secret so
those cookies can't be forged:

```
AUTH_SECRET=<a long random string, e.g. `openssl rand -base64 32`>
```

Without it the app still runs but uses an insecure built-in fallback and logs a
warning. Sessions also set the cookie `Secure` only over HTTPS, so login works
over plain HTTP before you attach a domain, and hardens automatically once
HTTPS is on.

If no writable directory is available, the app still runs, but from memory
only: data resets on every restart and a warning is logged
(`Could not write the database…`). Check `GET /api/rpc` — `"persistent": false`
means writes aren't landing on disk.

> Serverless hosts (Vercel, Netlify) can't run this file store at all — their
> functions are read-only and ephemeral, and requests hit different instances.
> Deploy to a Node-server host, or re-implement the `repo` layer against a real
> database (the `db/schema.sql` Postgres design is ready for exactly that).

## New features not showing after a deploy?

The code is client-rendered React, so if a deploy is serving old UI it's a
build/pipeline issue, not the app:

- Confirm the deploy built the **latest `main`** commit (not a pinned older
  commit or a different branch), and that auto-deploy actually ran.
- Trigger a fresh build with **cleared build cache**.
- Hard-refresh the browser (Ctrl/Cmd+Shift+R) to bypass cached assets.

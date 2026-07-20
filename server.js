// Startup file for hosts that launch a Node entry file instead of the
// `next start` CLI — notably Spaceship Shared Hosting / cPanel / CloudLinux's
// Node.js Selector, which runs everything through Phusion Passenger. Passenger
// spawns this file directly and expects it to listen on the port (or Unix
// socket path) it hands over in `process.env.PORT`. It hands every request to
// Next's own handler against the production `next build` output.
// (On a plain VPS you can still use `npm run start:next` / `next start`.)
//
// Note: the auth session and data store are server-side, so this must run as
// a long-lived Node process with a writable HOSTEL_DATA_DIR — see DEPLOY.md.
//
// Build note: `next build` must be run with `--webpack` (see the "build"
// script in package.json) — CloudLinux's Node.js Selector provisions
// node_modules as a symlink into a version-specific directory outside the
// project root, and Turbopack's build refuses to resolve packages through
// that symlink ("Symlink [project]/node_modules is invalid, it points out of
// the filesystem root"). Webpack has no such restriction.

const { createServer } = require("http");
const next = require("next");

const port = process.env.PORT || 3000;
const app = next({ dev: false });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = createServer((req, res) => {
      handle(req, res).catch((err) => {
        console.error("Request handler error:", err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("Internal Server Error");
        }
      });
    });

    server.on("error", (err) => {
      console.error("Server error:", err);
      process.exit(1);
    });

    server.listen(port, () => {
      console.log(`> Hostel ERP ready on ${port}`);
    });

    // Passenger stops the app with SIGTERM/SIGINT on redeploy or restart.txt
    // touch; finish in-flight requests before exiting so `after()` callbacks
    // and in-progress writes to the JSON store complete cleanly.
    const shutdown = (signal) => {
      console.log(`> Received ${signal}, shutting down`);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 10_000).unref();
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });

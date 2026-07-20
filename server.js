// Startup file for hosts that launch a Node entry file instead of the
// `next start` CLI — notably cPanel / Phusion Passenger. It hands every
// request to Next's own handler against the production `next build` output.
// (On a plain VPS you can still use `npm start` / `next start` instead.)
//
// Note: the auth session and data store are server-side, so this must run as a
// long-lived Node process with a writable HOSTEL_DATA_DIR — see DEPLOY.md.

const { createServer } = require("http");
const next = require("next");

const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(process.env.PORT || 3000);
});

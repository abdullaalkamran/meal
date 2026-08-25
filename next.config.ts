import type { NextConfig } from "next";

// Baseline hardening headers — conservative on purpose. script-src/style-src
// keep 'unsafe-inline' since Next injects inline hydration scripts and this
// app has inline styles in a few places; a nonce-based strict CSP is a
// bigger, separate change. Fonts load via next/font/google (self-hosted at
// build time, no runtime request to Google's CDN), so no font-CDN origins
// are needed here. data: is allowed for img/font since avatars/profile
// photos are stored as data URIs.
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    // Dev-mode React relies on eval() for its debugging overlay (stack
    // reconstruction, Fast Refresh) — script-src here has no 'unsafe-eval'
    // on purpose (it's a real hardening measure for the deployed site), so
    // only send these on `next start`/production, never `next dev`.
    if (process.env.NODE_ENV !== "production") return [];
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
  experimental: {
    // Next defaults this to `os.cpus().length - 1` and uses it as the size
    // of the build worker pool (page-data collection + static generation).
    // Each worker is a forked process with its own libuv/V8 threads, so on
    // CloudLinux shared hosting — where `nproc` reports the host's full
    // core count but the account's pthread/process limit (LVE) is far
    // lower — that many concurrent workers hits the limit and the build
    // dies with `pthread_create: Resource temporarily unavailable` /
    // `SIGABRT`. Capping it keeps the build inside the account's limits
    // everywhere, at the cost of a slower build.
    cpus: 2,
    // Ensure workers are separate processes (the default), not
    // worker_threads within one process — keep this explicit since the
    // whole point of `cpus` here is capping OS-level thread/process count.
    workerThreads: false,
  },
};

export default nextConfig;

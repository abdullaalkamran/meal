import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

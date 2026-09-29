import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Turbopack's persistent dev cache can get corrupted (notably on Windows / paths with spaces),
    // after which every compile panics with `PoisonError` in turbopack_ctx.rs. Disabling it keeps dev stable.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;

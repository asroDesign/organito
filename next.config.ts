import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the self-hosted update worker build into a temporary directory and
  // switch the production build only after compilation and migrations succeed.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Keep Turbopack rooted in this project; a parent package-lock.json can otherwise
  // make it watch the user's home directory and fail to resolve the app routes.
  turbopack: { root: process.cwd() },
  experimental: {
    // Turbopack's persistent dev cache can get corrupted (notably on Windows / paths with spaces),
    // after which every compile panics with `PoisonError` in turbopack_ctx.rs. Disabling it keeps dev stable.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;

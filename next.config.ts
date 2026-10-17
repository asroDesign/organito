import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep generated metadata in <head> for every user agent (including Lighthouse
  // and browser audits), instead of streaming it into <body> after the first HTML.
  htmlLimitedBots: /.*/,
  // Lets the self-hosted update worker build into a temporary directory and
  // switch the production build only after compilation and migrations succeed.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The gallery's custom loader serves only these responsive widths through
  // the media endpoint, which can return an existing derivative or create an
  // optimized WebP/AVIF fallback for legacy uploads.
  images: { deviceSizes: [320, 640, 960, 1280, 1600], imageSizes: [320] },
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

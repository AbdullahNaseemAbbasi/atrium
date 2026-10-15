import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Profile photos: Supabase Storage (public avatars bucket) and the randomuser.me placeholders used in memory mode.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "randomuser.me", pathname: "/api/portraits/**" },
    ],
  },
  experimental: {
    // Profile photos (up to 1.5 MB) are posted to a server action; project files go straight to storage.
    serverActions: { bodySizeLimit: "2mb" },
    // Keep visited workspace pages in the browser for 30s so going back to one is instant.
    // Safe with live data: every server action that saves (refresh/revalidatePath) and every
    // Realtime refresh (router.refresh) empties this whole cache, so a change made by anyone is
    // never hidden behind a cached page.
    staleTimes: { dynamic: 30 },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

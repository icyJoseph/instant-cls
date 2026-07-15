import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components powers the streaming "static shell" that lets skeleton
  // fallbacks render instantly. It is also required for the `instant` route
  // segment export and the `@next/playwright` `instant()` test helper.
  cacheComponents: true,
};

export default nextConfig;

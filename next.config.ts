import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components powers the streaming "static shell" that lets skeleton
  // fallbacks render instantly. It is also required for the `instant` route
  // segment export and the `@next/playwright` `instant()` test helper.
  cacheComponents: true,
  experimental: {
    // The instant() navigation lock machinery is stripped from production
    // bundles by default (aliased to an inert stub). Because we run the e2e
    // suite against `next build && next start`, we must opt the testing API
    // back in — otherwise instant() is a no-op and can't freeze the shell
    // (this is what makes the freeze work on direct/SSR visits too).
    exposeTestingApiInProductionBuild: true,
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  typedRoutes: true,
  images: {
    // Every avatar_url / current_company_logo_url / company_logo_url in data/candidates.json
    // is served from https://rotto.com/rotto/...
    remotePatterns: [
      { protocol: "https", hostname: "rotto.com", pathname: "/rotto/**" },
    ],
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

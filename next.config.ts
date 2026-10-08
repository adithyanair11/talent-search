import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// The browser talks to Supabase directly only for sign-in/out (src/features/auth). Next loads .env.local before
// this file, and real environment variables win, as everywhere else.
const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321").origin;

// 'unsafe-inline' scripts: nonces would force every page to render per request, which defeats cacheComponents'
// static shells, and next-themes plus Next's RSC payload are inline scripts. See docs/decisions.md ("Security pass").
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Avatars and logos are SVGs on rotto.com, which redirects to www.rotto.com; the browser loads them directly.
  "img-src 'self' data: blob: https://rotto.com https://www.rotto.com",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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

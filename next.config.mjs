import createNextIntlPlugin from "next-intl/plugin";

/**
 * Static security headers (Plan 1.5).
 *
 * Content-Security-Policy is intentionally absent here: it is emitted per
 * request by `src/middleware.ts` so it can carry a nonce. Declaring it in both
 * places would send two CSP headers, and browsers enforce the intersection.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // HSTS: browsers ignore this over plain HTTP, so it is safe in local dev.
  // "preload" is deliberately omitted — submitting to the preload list is a
  // long-lived commitment that should be a explicit deployment decision.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    esmExternals: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.r2.dev" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // The service worker must not be cached, or clients get stuck on an
        // old asset manifest after a deploy.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        source: "/.well-known/security.txt",
        headers: [{ key: "Content-Type", value: "text/plain; charset=utf-8" }],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();

/**
 * Bundle analysis (Plan 3.3). Opt-in and dependency-free at runtime:
 * `ANALYZE=true npm run build` after `npm i -D @next/bundle-analyzer`.
 * When the package is absent the build proceeds unchanged.
 */
async function withOptionalAnalyzer(config) {
  if (process.env.ANALYZE !== "true") return config;
  try {
    const { default: withBundleAnalyzer } = await import("@next/bundle-analyzer");
    return withBundleAnalyzer({ enabled: true, openAnalyzer: false })(config);
  } catch {
    console.warn("[next.config] ANALYZE=true but @next/bundle-analyzer is not installed — skipping.");
    return config;
  }
}

export default await withOptionalAnalyzer(withNextIntl(nextConfig));

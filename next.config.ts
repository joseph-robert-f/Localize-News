import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  // Prevent these native-Node.js packages from being bundled by webpack.
  // They must run in the Node.js runtime (API routes with `export const runtime = "nodejs"`).
  serverExternalPackages: [
    "playwright",
    "playwright-core",
    "@playwright/test",
    "tesseract.js",
    "pdf-parse",
  ],

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

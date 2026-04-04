import type { NextConfig } from "next";

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
};

export default nextConfig;

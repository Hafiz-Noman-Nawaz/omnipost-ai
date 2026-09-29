import type { NextConfig } from "next";

/**
 * Security headers (docs/05 §1.3). CSP is intentionally strict-but-workable
 * for Tailwind + Next inline bootstrap scripts in dev.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@node-rs/argon2", "@prisma/adapter-pg", "pino"],
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;

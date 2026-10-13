import type { NextConfig } from "next";

// In dev the API host follows the page host (see src/lib/api.ts), so
// next/image has to allow LAN addresses too.
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  images: {
    // Dev only: next/image blocks local/LAN IPs by default.
    ...(isDev ? { dangerouslyAllowLocalIP: true } : {}),
    remotePatterns: [
      { protocol: "http" as const, hostname: "localhost", port: "8000", pathname: "/media/**" },
      { protocol: "http" as const, hostname: "127.0.0.1", port: "8000", pathname: "/media/**" },
      // Production: nginx serves /media/ on the same domain.
      { protocol: "https" as const, hostname: "thebarathon.sashakuz.com", pathname: "/media/**" },
      ...(isDev
        ? [
            { protocol: "http" as const, hostname: "192.168.*.*", port: "8000", pathname: "/media/**" },
            { protocol: "http" as const, hostname: "10.*.*.*", port: "8000", pathname: "/media/**" },
            { protocol: "http" as const, hostname: "172.*.*.*", port: "8000", pathname: "/media/**" },
          ]
        : []),
    ],
  },
  // Dev only: allow opening the dev server from a phone on the LAN.
  ...(isDev
    ? {
        allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
      }
    : {}),
};

export default nextConfig;

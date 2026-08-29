import type { NextConfig } from "next";

// In dev, the API host is whatever hostname the page was loaded from (see
// src/lib/api.ts) so it also works from a phone on the same Wi-Fi via a LAN
// IP — next/image needs those LAN patterns whitelisted too, or photos served
// from the backend would silently fail to load on any device but the one
// running the dev server.
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  images: {
    // Next 16 blocks next/image from fetching any URL that resolves to a
    // private/local IP by default (SSRF hardening) — but our backend is
    // always on localhost or a private LAN IP in dev, so every photo would
    // 400 without this. Never enable in production.
    ...(isDev ? { dangerouslyAllowLocalIP: true } : {}),
    remotePatterns: [
      { protocol: "http" as const, hostname: "localhost", port: "8000", pathname: "/media/**" },
      { protocol: "http" as const, hostname: "127.0.0.1", port: "8000", pathname: "/media/**" },
      // Production: media is served over the same public domain (nginx
      // proxies /media/ straight to the Django media root, see nginx config).
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
  // The dev server itself also blocks cross-origin requests to its HMR/asset
  // endpoints (separately from the images allowlist above) unless the
  // requesting host is listed here — needed to load the app at all from a
  // phone via a LAN IP, not just to load images from the backend.
  ...(isDev
    ? {
        allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
      }
    : {}),
};

export default nextConfig;

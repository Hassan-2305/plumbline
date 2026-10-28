import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Content moved from /review to /content; keep old links working.
  async redirects() {
    return [
      { source: "/review", destination: "/content", permanent: false },
      { source: "/review/:path*", destination: "/content/:path*", permanent: false },
    ];
  },
  /* config options here */
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

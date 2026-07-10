import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a self-contained server.js and only the traced
  // node_modules. Required for the small Docker image used on the OVH box.
  // Vercel ignores this and builds its own way, so both targets keep working.
  output: "standalone",
};

export default nextConfig;

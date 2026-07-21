import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a self-contained server.js and only the traced
  // node_modules. Required for the small Docker image used on the OVH box.
  // Vercel ignores this and builds its own way, so both targets keep working.
  output: "standalone",
  // exceljs is a large Node library used only in the import route to read Excel
  // uploads. Keep it out of the bundler and require it at runtime, which avoids
  // Turbopack choking on its optional deps and keeps the client bundle lean.
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;

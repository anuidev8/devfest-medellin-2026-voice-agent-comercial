import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // NOTE: scaffold enabled cacheComponents, which breaks prerendering
  // (_not-found) with CopilotKit's client runtime. Disabled intentionally.
  turbopack: {
    root: path.join(__dirname, "..", ".."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pdfjs-dist manages its own worker-thread loading internally (including a
  // "fake worker" fallback path); webpack's bundling of that logic breaks worker
  // module resolution under Next's server runtime. Leaving it external makes
  // Next require() it via plain Node instead, where it works exactly as it does
  // under tsc/vitest.
  serverExternalPackages: ["pdfjs-dist"],
  webpack: (config) => {
    // Source uses explicit ".js" extensions on relative imports (Node ESM convention,
    // resolved correctly by tsc/vitest) even though the files are .ts/.tsx — webpack
    // needs to be told to also try those extensions for a ".js" specifier.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;

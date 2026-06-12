import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source — Next compiles them in-place.
  transpilePackages: ["@nlr/config", "@nlr/movepro", "@nlr/ui"],
  // PGlite locates its WASM via import.meta.url — bundling breaks it.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;

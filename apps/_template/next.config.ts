import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source — Next compiles them in-place.
  transpilePackages: ["@nlr/config", "@nlr/movepro", "@nlr/ui"],
};

export default nextConfig;

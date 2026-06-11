import type { MetadataRoute } from "next";

// Vercel preview deployments are noindexed automatically; this governs
// production. Adjust per app if it shouldn't be indexed.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
  };
}

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The catalogue is read from disk at runtime rather than bundled, so it has to
  // be traced into the production output explicitly.
  outputFileTracingIncludes: {
    "/api/**": ["./data/catalogue.json"],
    "/**": ["./data/catalogue.json"],
  },
};

export default nextConfig;

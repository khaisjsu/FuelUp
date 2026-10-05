import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Produces a small self-contained server for the Docker image. Vercel ignores it.
  output: "standalone",
};

export default nextConfig;

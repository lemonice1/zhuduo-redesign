import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  allowedDevOrigins: process.env.VM_HOST ? [process.env.VM_HOST] : [],
  typedRoutes: true
};

export default nextConfig;

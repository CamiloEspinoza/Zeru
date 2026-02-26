import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@zeru/shared"],
  output: "standalone",
};

export default nextConfig;

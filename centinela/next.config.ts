import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Ensure Turbopack uses the centinela folder as the workspace root
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

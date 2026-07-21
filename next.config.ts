import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    dangerouslyAllowLocalIP: true,
  },
};

export default nextConfig;

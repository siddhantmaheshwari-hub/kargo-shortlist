import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Scene-setting photography only (never used for candidates).
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com", pathname: "/**" }],
  },
};

export default nextConfig;

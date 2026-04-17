import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Railway DNS fix: allow all origins in dev
  allowedDevOrigins: [".railway.app", ".up.railway.app", ".space.chatglm.site"],
};

export default nextConfig;

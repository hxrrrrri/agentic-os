import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["sql.js", "@homebridge/node-pty-prebuilt-multiarch"],
};

export default nextConfig;

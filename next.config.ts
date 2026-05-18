import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["sql.js", "@homebridge/node-pty-prebuilt-multiarch"],
};

export default nextConfig;

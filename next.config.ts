import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sql.js", "@homebridge/node-pty-prebuilt-multiarch"],
};

export default nextConfig;

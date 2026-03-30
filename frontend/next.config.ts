import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = config.resolve.alias ?? {};
    config.resolve.alias.WebSdk = path.resolve(
      __dirname,
      "src/digitalpersona/websdk.ts",
    );

    return config;
  },
};

export default nextConfig;

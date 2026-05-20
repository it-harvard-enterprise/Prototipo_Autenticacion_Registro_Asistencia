import type { NextConfig } from "next";
import path from "node:path";

const projectRoot = __dirname;
const webSdkAliasPath = path.resolve(
  projectRoot,
  "src/digitalpersona/websdk.ts",
);

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    localPatterns: [
      {
        pathname: "/api/course-materials/cover",
      },
      {
        pathname: "/logos/**",
      },
    ],
  },
  turbopack: {
    root: projectRoot,
    resolveAlias: {
      WebSdk: webSdkAliasPath,
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = config.resolve.alias ?? {};
    config.resolve.alias.WebSdk = webSdkAliasPath;

    return config;
  },
};

export default nextConfig;

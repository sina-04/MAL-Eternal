import type { NextConfig } from "next";

const isGitHubPages = process.env.MAL_GITHUB_PAGES === "1";
const nextConfig: NextConfig = {
  ...(isGitHubPages ? { output: "export" as const } : {}),
  trailingSlash: isGitHubPages,
};

export default nextConfig;

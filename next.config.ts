import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app reads all secrets server-side; only NEXT_PUBLIC_* vars reach the browser.
  reactStrictMode: true,
};

export default nextConfig;

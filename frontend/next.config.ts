import type { NextConfig } from "next";

const apiOrigin = (process.env.FLAME_API_ORIGIN ?? "http://127.0.0.1:8000").replace(/\/$/, "");
if (process.env.VERCEL && !process.env.FLAME_API_ORIGIN) {
  throw new Error("Set FLAME_API_ORIGIN to the deployed FastAPI production URL before deploying the frontend.");
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    return [{ source: "/service/:path*", destination: `${apiOrigin}/:path*` }];
  },
};

export default nextConfig;

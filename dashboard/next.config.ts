import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/docs',
        destination: 'https://bastion-docs.vercel.app/docs',
      },
      {
        source: '/docs/:path*',
        destination: 'https://bastion-docs.vercel.app/docs/:path*',
      },
    ]
  },
};

export default nextConfig;

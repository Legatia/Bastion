import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/docs',
        destination: 'https://bastion-docs.vercel.app',
      },
      {
        source: '/docs/:path*',
        destination: 'https://bastion-docs.vercel.app/:path*',
      },
    ]
  },
};

export default nextConfig;

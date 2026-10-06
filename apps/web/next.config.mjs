/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // A separate folder for a production build while `next dev` runs (NEXT_DIST_DIR=.next-prod)
  distDir: process.env.NEXT_DIST_DIR || '.next',
  transpilePackages: ['@hrms/types'],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;

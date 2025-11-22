/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Required for static export compatibility
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig

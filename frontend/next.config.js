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
  // Fix for pino-pretty module not found error
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    // Ignore pino-pretty since it's optional
    config.externals = config.externals || [];
    config.externals.push('pino-pretty');
    return config;
  },
}

module.exports = nextConfig

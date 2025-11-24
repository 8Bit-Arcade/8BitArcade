/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standalone for Firebase App Hosting (server-side)
  // Change to 'export' if deploying to static hosting instead
  output: 'standalone',

  images: {
    unoptimized: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Never bundle Node.js-only or React Native packages into client bundle
      config.resolve.alias = {
        ...config.resolve.alias,
        'undici': false, // Node.js fetch library - use browser fetch
        '@react-native-async-storage/async-storage': false, // React Native only
        'react-native': false, // React Native not needed in web
      };

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

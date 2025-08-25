/** @type {import('next').NextConfig} */

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: './.env' });
}

try {
  require('./lib/env.server');
} catch (err) {
  console.error('Environment validation failed:', err.message);
  throw err;
}

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,

  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'node:https': 'https',
      'node:http': 'http',
      'node:zlib': 'zlib',
    };
    return config;
  },

  // The security headers are now set in middleware.js
  // This allows for dynamic values like nonces and is the recommended approach.
};

module.exports = nextConfig;

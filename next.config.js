/** @type {import('next').NextConfig} */

require('./lib/env');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  // The security headers are now set in middleware.js
  // This allows for dynamic values like nonces and is the recommended approach.
};

module.exports = nextConfig;

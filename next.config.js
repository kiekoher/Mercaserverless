/** @type {import('next').NextConfig} */

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: './.env' });
}
require('./lib/env.server');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  poweredByHeader: false,

  // The security headers are now set in middleware.js
  // This allows for dynamic values like nonces and is the recommended approach.
};

module.exports = nextConfig;

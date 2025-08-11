/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  // The security headers are now set in middleware.js
  // This allows for dynamic values like nonces and is the recommended approach.
};

module.exports = nextConfig;

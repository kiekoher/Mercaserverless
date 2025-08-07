/** @type {import('next').NextConfig} */

// Definir cabeceras de seguridad.
// Nota: Content-Security-Policy (CSP) no se incluye aquí por su complejidad.
// Una política CSP estricta requiere una auditoría completa de todos los scripts,
// estilos y fuentes de contenido para evitar romper la aplicación.

const CspHeader = `
    default-src 'self';
    script-src 'self';
    style-src 'self' https://fonts.googleapis.com;
    img-src 'self' blob: data:;
    media-src 'none';
    frame-src 'none';
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' *.supabase.co *.googleapis.com;
`.replace(/\s{2,}/g, ' ').trim();

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: CspHeader,
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Referrer-Policy',
    value: 'no-referrer',
  },
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(), camera=(), microphone=()'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  }
];

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  async headers() {
    return [
      {
        // Aplicar estas cabeceras a todas las rutas
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;

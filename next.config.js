/** @type {import('next').NextConfig} */

// Definir cabeceras de seguridad.
// Nota: Content-Security-Policy (CSP) no se incluye aquí por su complejidad.
// Una política CSP estricta requiere una auditoría completa de todos los scripts,
// estilos y fuentes de contenido para evitar romper la aplicación.
const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
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

import Link from 'next/link';

export default function Custom404() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>404 - Página no encontrada</h1>
      <p>La página solicitada no existe.</p>
      <p>
        <Link href="/">Volver al inicio</Link>
      </p>
    </main>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '../context/Auth';
import { useRouter } from 'next/router';

export default function MiRutaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [ruta, setRuta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const fetchRuta = async () => {
      try {
        const res = await fetch('/api/mi-ruta');
        if (res.status === 404) {
          setError('No tienes una ruta asignada para hoy.');
          return;
        }
        if (!res.ok) throw new Error('Error al cargar la ruta.');
        const data = await res.json();
        setRuta(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRuta();
  }, [user, router]);

  if (loading || !user) {
    return (
      <div style={{ padding: '20px' }}>
        <p>Cargando tu ruta...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
        <h1>Tu Ruta para Hoy</h1>
        <p><strong>Fecha:</strong> {new Date().toLocaleDateString('es-CO')}</p>
      </header>

      {error && <p style={{ color: 'orange', fontWeight: 'bold' }}>{error}</p>}

      {!error && ruta && (
        <div>
          <h2 style={{ fontSize: '1.2em', marginBottom: '15px' }}>Puntos de Venta a Visitar:</h2>
          <ol style={{ listStyle: 'none', padding: 0 }}>
            {ruta.puntos.map((punto, index) => (
              <li key={punto.id} style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '10px', borderRadius: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.5em', fontWeight: 'bold', marginRight: '15px' }}>{index + 1}</span>
                  <div>
                    <strong style={{ fontSize: '1.1em' }}>{punto.nombre}</strong>
                    <p style={{ margin: '5px 0 0', color: '#555' }}>{punto.direccion}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '../context/Auth';
import { useRouter } from 'next/router';

export default function PuntosDeVentaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [puntos, setPuntos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form state
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Protect the route
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  const fetchPuntos = async () => {
    try {
      const res = await fetch('/api/puntos-de-venta');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setPuntos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPuntos();
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/puntos-de-venta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, direccion, ciudad }),
      });
      if (!res.ok) throw new Error('Failed to create point of sale');
      // Reset form and refresh list
      setNombre('');
      setDireccion('');
      setCiudad('');
      await fetchPuntos(); // Await to ensure list is updated before submission state changes
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return <div>Cargando...</div>;
  }

  return (
    <div style={{ padding: '40px' }}>
      <h1>Gestión de Puntos de Venta</h1>

      <div style={{ display: 'flex', gap: '40px', marginTop: '20px' }}>
        <div style={{ flex: 1 }}>
          <h2>Listado Actual</h2>
          {loading && <p>Cargando puntos de venta...</p>}
          {error && <p style={{ color: 'red' }}>Error: {error}</p>}
          {!loading && !error && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Nombre</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Dirección</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Ciudad</th>
                </tr>
              </thead>
              <tbody>
                {puntos.map((punto) => (
                  <tr key={punto.id}>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{punto.nombre}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{punto.direccion}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{punto.ciudad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ flex: 1, maxWidth: '400px' }}>
          <h2>Añadir Nuevo Punto</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label>Nombre</label>
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label>Dirección</label>
              <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label>Ciudad</label>
              <input type="text" value={ciudad} onChange={(e) => setCiudad(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
            </div>
            <button type="submit" disabled={isSubmitting} style={{ padding: '10px 20px', width: '100%' }}>
              {isSubmitting ? 'Guardando...' : 'Guardar Punto'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

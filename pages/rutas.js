import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '../context/Auth';
import { useRouter } from 'next/router';

export default function RutasPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [rutas, setRutas] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [mercaderistaId, setMercaderistaId] = useState('');
  const [selectedPuntos, setSelectedPuntos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [summaries, setSummaries] = useState({});
  const [summaryLoading, setSummaryLoading] = useState(null);

  useEffect(() => {
    if (!user) router.push('/login');
  }, [user, router]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rutasRes, puntosRes] = await Promise.all([
        fetch('/api/rutas'),
        fetch('/api/puntos-de-venta'),
      ]);
      if (!rutasRes.ok || !puntosRes.ok) throw new Error('Failed to fetch data');
      const [rutasData, puntosData] = await Promise.all([ rutasRes.json(), puntosRes.json() ]);
      setRutas(rutasData);
      setPuntos(puntosData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const handlePuntoSelection = (puntoId) => {
    setSelectedPuntos(prev => prev.includes(puntoId) ? prev.filter(id => id !== puntoId) : [...prev, puntoId]);
  };

  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleOptimizeRoute = async () => {
    if (selectedPuntos.length < 2) {
      setError("Selecciona al menos 2 puntos para optimizar.");
      return;
    }
    setIsOptimizing(true);
    setError(null);
    try {
      const puntosAOptimizar = puntos.filter(p => selectedPuntos.includes(p.id));
      const res = await fetch('/api/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puntos: puntosAOptimizar }),
      });
      if (!res.ok) throw new Error('La optimización falló');
      const data = await res.json();

      // Reorder the main `puntos` list to reflect the optimized order visually
      const optimizedIds = data.optimizedPuntos.map(p => p.id);
      const remainingPuntos = puntos.filter(p => !optimizedIds.includes(p.id));
      const reorderedPuntos = [...data.optimizedPuntos, ...remainingPuntos];

      setPuntos(reorderedPuntos);
      setSelectedPuntos(optimizedIds); // Update the selection to match the new order

    } catch (err) {
      setError(err.message);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedPuntos.length === 0) {
      setError('Debes seleccionar al menos un punto de venta.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/rutas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, mercaderistaId, puntosDeVentaIds: selectedPuntos }),
      });
      if (!res.ok) throw new Error('Failed to create route');
      setMercaderistaId('');
      setSelectedPuntos([]);
      await fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateSummary = async (ruta) => {
    setSummaryLoading(ruta.id);
    setSummaries(prev => ({ ...prev, [ruta.id]: null })); // Clear previous summary
    setError(null);
    try {
      const puntosDeRuta = ruta.puntosDeVentaIds.map(id => puntos.find(p => p.id === id)).filter(Boolean);
      const res = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: ruta.fecha,
          mercaderistaId: ruta.mercaderistaId,
          puntos: puntosDeRuta,
        }),
      });
      if (!res.ok) throw new Error('Failed to generate summary');
      const data = await res.json();
      setSummaries(prev => ({ ...prev, [ruta.id]: data.summary }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSummaryLoading(null);
    }
  };

  const getPuntoNombre = (id) => puntos.find(p => p.id === id)?.nombre || 'Desconocido';

  if (!user) return <div>Cargando...</div>;

  return (
    <div style={{ padding: '40px' }}>
      <h1>Gestión de Rutas</h1>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      <div style={{ display: 'flex', gap: '40px', marginTop: '20px' }}>
        <div style={{ flex: 2 }}>
          <h2>Rutas Creadas</h2>
          {loading ? <p>Cargando rutas...</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Fecha</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Mercaderista</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Puntos de Venta</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rutas.map((ruta) => (
                  <Fragment key={ruta.id}>
                    <tr>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{ruta.fecha}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{ruta.mercaderistaId}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        {ruta.puntosDeVentaIds.map(id => getPuntoNombre(id)).join(', ')}
                      </td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                        <button onClick={() => handleGenerateSummary(ruta)} disabled={summaryLoading === ruta.id}>
                          {summaryLoading === ruta.id ? 'Generando...' : 'Generar Resumen IA'}
                        </button>
                      </td>
                    </tr>
                    {summaries[ruta.id] && (
                      <tr>
                        <td colSpan="4" style={{ padding: '10px', background: '#f0f8ff', border: '1px solid #ddd' }}>
                          <strong>Resumen IA:</strong> {summaries[ruta.id]}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ flex: 1, maxWidth: '400px' }}>
          <h2>Crear Nueva Ruta</h2>
          <form onSubmit={handleSubmit}>
            {/* Form inputs are unchanged */}
            <div style={{ marginBottom: '16px' }}>
              <label>Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label>ID del Mercaderista</label>
              <input type="text" value={mercaderistaId} onChange={(e) => setMercaderistaId(e.target.value)} required placeholder="Ej: mercaderista-1" style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label>Puntos de Venta</label>
              <button type="button" onClick={handleOptimizeRoute} disabled={isOptimizing || selectedPuntos.length < 2} style={{ width: '100%', padding: '8px', margin: '8px 0', background: '#e0f7fa' }}>
                {isOptimizing ? 'Optimizando...' : 'Optimizar Selección con IA'}
              </button>
              <div style={{ border: '1px solid #ddd', padding: '10px', marginTop: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                {puntos.map(punto => (
                  <div key={punto.id}>
                    <input type="checkbox" id={`punto-${punto.id}`} checked={selectedPuntos.includes(punto.id)} onChange={() => handlePuntoSelection(punto.id)} />
                    <label htmlFor={`punto-${punto.id}`} style={{ marginLeft: '8px' }}>{punto.nombre}</label>
                  </div>
                ))}
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} style={{ padding: '10px 20px', width: '100%' }}>
              {isSubmitting ? 'Guardando...' : 'Guardar Ruta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

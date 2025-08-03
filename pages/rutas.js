import { useState, useEffect, Fragment } from 'react';
import { useAuth } from '../context/Auth';
import { useRouter } from 'next/router';
import {
  Container, Box, Typography, Button, Grid, Paper, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, Checkbox, FormControlLabel, FormGroup, Tooltip
} from '@mui/material';
import AppLayout from '../components/AppLayout'; // Assuming we create a shared layout component

export default function RutasPage() {
  const { user, profile } = useAuth();
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
  const [isOptimizing, setIsOptimizing] = useState(false);

  useEffect(() => {
    if (!user && process.env.NODE_ENV !== 'test') router.push('/login');
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

      const optimizedIds = data.optimizedPuntos.map(p => p.id);
      const remainingPuntos = puntos.filter(p => !optimizedIds.includes(p.id));
      const reorderedPuntos = [...data.optimizedPuntos, ...remainingPuntos];

      setPuntos(reorderedPuntos);
      setSelectedPuntos(optimizedIds);
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
      await fetch('/api/rutas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, mercaderistaId, puntosDeVentaIds: selectedPuntos }),
      });
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
    setSummaries(prev => ({ ...prev, [ruta.id]: null }));
    setError(null);
    try {
      const puntosDeRuta = ruta.puntosDeVentaIds.map(id => puntos.find(p => p.id === id)).filter(Boolean);
      const res = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: ruta.fecha, mercaderistaId: ruta.mercaderistaId, puntos: puntosDeRuta }),
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

  if (!user || !profile) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
  }

  if (profile.role !== 'supervisor') {
    return <AppLayout profile={profile}><Alert severity="error">No tienes permiso para ver esta página.</Alert></AppLayout>
  }

  return (
    <AppLayout profile={profile}>
      <Typography variant="h4" gutterBottom>Gestión de Rutas</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          <Typography variant="h6" gutterBottom>Rutas Creadas</Typography>
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Mercaderista</TableCell>
                    <TableCell>Puntos de Venta</TableCell>
                    <TableCell>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={4} align="center"><CircularProgress /></TableCell></TableRow>
                  ) : rutas.map((ruta) => (
                    <Fragment key={ruta.id}>
                      <TableRow>
                        <TableCell>{ruta.fecha}</TableCell>
                        <TableCell>{ruta.mercaderistaId}</TableCell>
                        <TableCell>{ruta.puntosDeVentaIds.map(id => getPuntoNombre(id)).join(', ')}</TableCell>
                        <TableCell>
                          <Tooltip title="Generar resumen con IA">
                            <Button size="small" onClick={() => handleGenerateSummary(ruta)} disabled={summaryLoading === ruta.id}>
                              {summaryLoading === ruta.id ? <CircularProgress size={20} /> : 'Resumen'}
                            </Button>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                      {summaries[ruta.id] && (
                        <TableRow>
                          <TableCell colSpan={4} sx={{ bgcolor: 'action.hover' }}>
                            <Typography variant="body2"><strong>Resumen IA:</strong> {summaries[ruta.id]}</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Typography variant="h6" gutterBottom>Crear Nueva Ruta</Typography>
          <Paper component="form" onSubmit={handleSubmit} sx={{ p: 2 }}>
            <TextField
              label="Fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="ID del Mercaderista"
              value={mercaderistaId}
              onChange={(e) => setMercaderistaId(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
            />
            <Typography variant="subtitle1" gutterBottom>Puntos de Venta</Typography>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleOptimizeRoute}
              disabled={isOptimizing || selectedPuntos.length < 2}
              sx={{ mb: 1 }}
            >
              {isOptimizing ? <CircularProgress size={24} /> : 'Optimizar Selección con IA'}
            </Button>
            <Paper variant="outlined" sx={{ p: 1, maxHeight: 200, overflow: 'auto', mb: 2 }}>
              <FormGroup>
                {puntos.map(punto => (
                  <FormControlLabel
                    key={punto.id}
                    control={<Checkbox checked={selectedPuntos.includes(punto.id)} onChange={() => handlePuntoSelection(punto.id)} />}
                    label={punto.nombre}
                  />
                ))}
              </FormGroup>
            </Paper>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={isSubmitting}
            >
              {isSubmitting ? <CircularProgress size={24} /> : 'Guardar Ruta'}
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </AppLayout>
  );
}

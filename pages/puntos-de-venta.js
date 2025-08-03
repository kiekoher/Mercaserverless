import { useState, useEffect } from 'react';
import { useAuth } from '../context/Auth';
import { useRouter } from 'next/router';
import {
  Typography, Button, Grid, Paper, TextField, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, Box
} from '@mui/material';
import AppLayout from '../components/AppLayout';

export default function PuntosDeVentaPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [puntos, setPuntos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!user && process.env.NODE_ENV !== 'test') router.push('/login');
  }, [user, router]);

  const fetchPuntos = async () => {
    try {
      const res = await fetch('/api/puntos-de-venta');
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch');
      }
      const data = await res.json();
      setPuntos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchPuntos();
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
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create point of sale');
      }
      setNombre('');
      setDireccion('');
      setCiudad('');
      await fetchPuntos();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user || !profile) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
  }

  if (profile.role !== 'supervisor') {
    return <AppLayout><Alert severity="error">No tienes permiso para ver esta página.</Alert></AppLayout>
  }

  return (
    <AppLayout>
      <Typography variant="h4" gutterBottom>Gestión de Puntos de Venta</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          <Typography variant="h6" gutterBottom>Listado Actual</Typography>
          <Paper>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nombre</TableCell>
                    <TableCell>Dirección</TableCell>
                    <TableCell>Ciudad</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={3} align="center"><CircularProgress /></TableCell></TableRow>
                  ) : puntos.map((punto) => (
                    <TableRow key={punto.id}>
                      <TableCell>{punto.nombre}</TableCell>
                      <TableCell>{punto.direccion}</TableCell>
                      <TableCell>{punto.ciudad}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Typography variant="h6" gutterBottom>Añadir Nuevo Punto</Typography>
          <Paper component="form" onSubmit={handleSubmit} sx={{ p: 2 }}>
            <TextField
              label="Nombre del Punto"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
            />
            <TextField
              label="Dirección"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
            />
            <TextField
              label="Ciudad"
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              fullWidth
              required
              sx={{ mb: 2 }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={isSubmitting}
            >
              {isSubmitting ? <CircularProgress size={24} /> : 'Guardar Punto'}
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </AppLayout>
  );
}

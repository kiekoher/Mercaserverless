import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/Auth';
import { useRouter } from 'next/router';
import {
  Typography, Button, Grid, Paper, TextField, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Box, Pagination
} from '@mui/material';
import AppLayout from '../components/AppLayout';
import { useDebounce } from '../hooks/useDebounce';
import { useSnackbar } from 'notistack';

export default function PuntosDeVentaPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const [puntos, setPuntos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination and Search state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const fetchPuntos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, search: debouncedSearchTerm });
      const res = await fetch(`/api/puntos-de-venta?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch');
      }
      const data = await res.json();
      const totalCount = res.headers.get('X-Total-Count');
      setTotalPages(Math.ceil(totalCount / 10));
      setPuntos(data);
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearchTerm, enqueueSnackbar]);

  useEffect(() => {
    if (user) fetchPuntos();
  }, [user, fetchPuntos]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
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
      enqueueSnackbar('Punto de venta creado con éxito!', { variant: 'success' });
      await fetchPuntos();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user || !profile) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
  }

  if (profile.role !== 'supervisor') {
    return <AppLayout><Typography sx={{p: 2}}>No tienes permiso para ver esta página.</Typography></AppLayout>
  }

  return (
    <AppLayout>
      <Typography variant="h4" gutterBottom>Gestión de Puntos de Venta</Typography>
      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          <Paper>
            <Box sx={{ p: 2 }}>
              <TextField
                fullWidth
                label="Buscar por nombre"
                variant="outlined"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Box>
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
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(e, value) => setPage(value)}
                color="primary"
              />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Typography variant="h6" gutterBottom>Añadir Nuevo Punto</Typography>
          <Paper component="form" onSubmit={handleSubmit} sx={{ p: 2 }}>
            <TextField label="Nombre del Punto" value={nombre} onChange={(e) => setNombre(e.target.value)} fullWidth required sx={{ mb: 2 }} />
            <TextField label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} fullWidth required sx={{ mb: 2 }} />
            <TextField label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} fullWidth required sx={{ mb: 2 }} />
            <Button type="submit" variant="contained" fullWidth disabled={isSubmitting}>
              {isSubmitting ? <CircularProgress size={24} /> : 'Guardar Punto'}
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </AppLayout>
  );
}

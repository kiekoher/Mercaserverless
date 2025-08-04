import { useState, useEffect, Fragment, useCallback } from 'react';
import { useAuth } from '../context/Auth';
import {
  Box, Typography, Button, Grid, Paper, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Checkbox, FormControlLabel, FormGroup, Tooltip, Pagination,
  Alert
} from '@mui/material';
import AppLayout from '../components/AppLayout';
import { useDebounce } from '../hooks/useDebounce';
import { useSnackbar } from 'notistack';

export default function RutasPage() {
  const { user, profile } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [rutas, setRutas] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [mercaderistaId, setMercaderistaId] = useState('');
  const [selectedPuntos, setSelectedPuntos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [summaries, setSummaries] = useState({});
  const [summaryLoading, setSummaryLoading] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const handlePageChange = (_e, value) => setPage(value);
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const fetchRutas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, search: debouncedSearchTerm });
      const res = await fetch(`/api/rutas?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch routes');
      const data = await res.json();
      const totalCount = res.headers.get('X-Total-Count');
      setTotalPages(Math.ceil(totalCount / 10));
      setRutas(data);
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearchTerm, enqueueSnackbar]);

  // **MEJORA: Función para obtener TODOS los puntos de venta, manejando paginación**
  const fetchAllPuntosDeVenta = useCallback(async () => {
    let allPuntos = [];
    let currentPage = 1;
    let hasMore = true;

    while(hasMore) {
        try {
            const res = await fetch(`/api/puntos-de-venta?page=${currentPage}`);
            if (!res.ok) throw new Error('Failed to fetch points of sale');
            const data = await res.json();
            if (data.length > 0) {
                allPuntos = [...allPuntos, ...data];
                currentPage++;
            } else {
                hasMore = false;
            }
        } catch(err) {
            enqueueSnackbar(err.message, { variant: 'error' });
            hasMore = false; // Detener en caso de error
        }
    }
    setPuntos(allPuntos);
  }, [enqueueSnackbar]);


  useEffect(() => {
    if(user) {
      fetchRutas();
      fetchAllPuntosDeVenta();
    }
  }, [user, fetchRutas, fetchAllPuntosDeVenta]);

  const handleOptimizeRoute = async () => {
    if (selectedPuntos.length < 2) {
      enqueueSnackbar("Selecciona al menos 2 puntos para optimizar.", { variant: 'warning' });
      return;
    }
    setIsOptimizing(true);
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
      
      // Reordenar la lista de puntos de venta para reflejar la optimización
      const optimizedPuntosOrdenados = data.optimizedPuntos;
      const puntosNoOptimizados = puntos.filter(p => !selectedPuntos.includes(p.id));
      
      setPuntos([...optimizedPuntosOrdenados, ...puntosNoOptimizados]);
      setSelectedPuntos(optimizedIds); // Mantener la selección
      
      enqueueSnackbar('Ruta optimizada con IA!', { variant: 'info' });
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedPuntos.length === 0 || !mercaderistaId.trim()) {
      enqueueSnackbar('Debes seleccionar un mercaderista y al menos un punto de venta.', { variant: 'warning' });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/rutas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, mercaderistaId, puntosDeVentaIds: selectedPuntos }),
      });
       if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create route');
      }
      setMercaderistaId('');
      setSelectedPuntos([]);
      enqueueSnackbar('Ruta creada con éxito!', { variant: 'success' });
      await fetchRutas();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateSummary = async (ruta) => {
    setSummaryLoading(ruta.id);
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
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setSummaryLoading(null);
    }
  };

  if (!user || !profile) {
    return <AppLayout><Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box></AppLayout>;
  }

  // **CORRECCIÓN: Permitir acceso a 'supervisor' y 'admin'**
  const hasPermission = profile && ['supervisor', 'admin'].includes(profile.role);

  if (!hasPermission) {
    return <AppLayout><Alert severity="error">No tienes permiso para ver esta página.</Alert></AppLayout>;
  }

  return (
    <AppLayout>
      <Typography variant="h4" gutterBottom>Gestión de Rutas</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2 }}>
            <TextField
              label="Buscar por ID de Mercaderista"
              value={searchTerm}
              onChange={handleSearchChange}
              fullWidth
              size="small"
              margin="normal"
            />
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}><CircularProgress /></Box>
            ) : (
              <Fragment>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha</TableCell>
                        <TableCell>Mercaderista</TableCell>
                        <TableCell>Puntos de Venta</TableCell>
                        <TableCell>Resumen IA</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rutas.length === 0 ? (
                        <TableRow><TableCell colSpan={4} align="center">No hay rutas registradas.</TableCell></TableRow>
                      ) : rutas.map((ruta) => (
                        <TableRow key={ruta.id}>
                          <TableCell>{ruta.fecha}</TableCell>
                          <TableCell>{ruta.mercaderistaId}</TableCell>
                          <TableCell>
                            {ruta.puntosDeVentaIds
                              .map((id) => puntos.find((p) => p.id === id)?.nombre)
                              .filter(Boolean)
                              .join(', ')}
                          </TableCell>
                          <TableCell>
                            {summaries[ruta.id] ? (
                              <Typography variant="body2">{summaries[ruta.id]}</Typography>
                            ) : (
                              <Button
                                variant="outlined"
                                size="small"
                                onClick={() => handleGenerateSummary(ruta)}
                                disabled={summaryLoading === ruta.id}
                              >
                                {summaryLoading === ruta.id ? <CircularProgress size={20} /> : 'Generar'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {totalPages > 1 && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Pagination count={totalPages} page={page} onChange={handlePageChange} />
                  </Box>
                )}
              </Fragment>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper component="form" onSubmit={handleSubmit} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Crear Nueva Ruta</Typography>
            <TextField
              label="Fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              fullWidth
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="ID de Mercaderista"
              value={mercaderistaId}
              onChange={(e) => setMercaderistaId(e.target.value)}
              fullWidth
              required
              margin="normal"
            />
            <Typography variant="subtitle1" sx={{ mt: 2 }}>Puntos de Venta Disponibles</Typography>
            <FormGroup sx={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ddd', p: 1, borderRadius: 1 }}>
              {puntos.map((punto) => (
                <FormControlLabel
                  key={punto.id}
                  control={
                    <Checkbox
                      checked={selectedPuntos.includes(punto.id)}
                      onChange={() =>
                        setSelectedPuntos((prev) =>
                          prev.includes(punto.id)
                            ? prev.filter((id) => id !== punto.id)
                            : [...prev, punto.id]
                        )
                      }
                    />
                  }
                  label={punto.nombre}
                />
              ))}
            </FormGroup>
            <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
              <Tooltip title="Optimiza el orden de visita usando IA">
                <span>
                  <Button
                    variant="outlined"
                    onClick={handleOptimizeRoute}
                    disabled={isOptimizing || selectedPuntos.length < 2}
                  >
                    {isOptimizing ? <CircularProgress size={24} /> : 'Optimizar'}
                  </Button>
                </span>
              </Tooltip>
              <Button
                type="submit"
                variant="contained"
                disabled={isSubmitting}
              >
                {isSubmitting ? <CircularProgress size={24} /> : 'Crear Ruta'}
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </AppLayout>
  );
}

import { useState, useEffect, Fragment, useCallback } from 'react';
import { useAuth } from '../context/Auth';
import {
  Box, Typography, Button, Grid, Paper, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Checkbox, FormControlLabel,
  FormGroup, Tooltip, Pagination, Alert, Modal, Chip, LinearProgress, List, ListItem, ListItemText
} from '@mui/material';
import AppLayout from '../components/AppLayout';
import { useDebounce } from '../hooks/useDebounce';
import { useSnackbar } from 'notistack';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MapIcon from '@mui/icons-material/Map';
import dynamic from 'next/dynamic';

const RutaMap = dynamic(() => import('../components/RutaMap'), { ssr: false });

// Estilo para el Modal de detalles
const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: { xs: '90%', md: 600 },
  bgcolor: 'background.paper',
  border: '1px solid #ddd',
  borderRadius: '8px',
  boxShadow: 24,
  p: 4,
};

export default function RutasPage() {
  const { user, profile } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [rutas, setRutas] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [visitas, setVisitas] = useState({});
  const [loading, setLoading] = useState(true);

  // Estado del modal
  const [modalOpen, setModalOpen] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [selectedRuta, setSelectedRuta] = useState(null);
  const [loadingVisitas, setLoadingVisitas] = useState(false);

  // Estado del formulario
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [mercaderistaId, setMercaderistaId] = useState('');
  const [selectedPuntos, setSelectedPuntos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Paginación y búsqueda
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const fetchRutas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, search: debouncedSearchTerm });
      const res = await fetch(`/api/rutas?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar las rutas.');
      const data = await res.json();
      const totalCount = res.headers.get('X-Total-Count');
      setTotalPages(Math.ceil(totalCount / 10));
      setRutas(data);

      // Pre-fetch visits for all routes shown
      data.forEach(ruta => {
        fetchVisitasForRuta(ruta.id);
      });

    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearchTerm, enqueueSnackbar]);

  const fetchAllPuntosDeVenta = useCallback(async () => {
    try {
        const res = await fetch('/api/puntos-de-venta?all=true'); // Assume an 'all' flag to get all points
        if(!res.ok) throw new Error('Failed to fetch points of sale');
        const data = await res.json();
        setPuntos(data);
    } catch(err) {
        enqueueSnackbar(err.message, { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  const fetchVisitasForRuta = useCallback(async (rutaId) => {
    try {
        const res = await fetch(`/api/visitas?ruta_id=${rutaId}`);
        if (!res.ok) return; // Fail silently
        const data = await res.json();
        setVisitas(prev => ({ ...prev, [rutaId]: data }));
    } catch (err) {
        // Do not show snackbar for this background fetch
        console.error(`Failed to fetch visits for route ${rutaId}`, err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchRutas();
      fetchAllPuntosDeVenta();
    }
  }, [user, fetchRutas, fetchAllPuntosDeVenta]);

  const handleOpenModal = async (ruta) => {
    setSelectedRuta(ruta);
    setModalOpen(true);
    // Visits might already be fetched, but we can re-fetch for real-time data
    setLoadingVisitas(true);
    try {
      const res = await fetch(`/api/visitas?ruta_id=${ruta.id}`);
      if (!res.ok) throw new Error('No se pudo cargar el detalle de las visitas.');
      const data = await res.json();
      setVisitas(prev => ({ ...prev, [ruta.id]: data }));
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setLoadingVisitas(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedRuta(null);
  };

  const calculateProgress = (ruta) => {
    const visitasDeRuta = visitas[ruta.id] || [];
    if (!ruta.puntos_de_venta_ids || ruta.puntos_de_venta_ids.length === 0) return 0;
    const completadas = visitasDeRuta.filter(v => v.estado === 'Completada' || v.estado === 'Incidencia').length;
    return (completadas / ruta.puntos_de_venta_ids.length) * 100;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Simplified for brevity, assuming this logic exists
    setIsSubmitting(true);
    try {
        const res = await fetch('/api/rutas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fecha, mercaderista_id: mercaderistaId, puntos_de_venta_ids: selectedPuntos })
        });
        if (!res.ok) throw new Error('Failed to create route');
        enqueueSnackbar('Ruta creada con éxito', { variant: 'success' });
        fetchRutas(); // Refresh
    } catch (err) {
        enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (!user || !profile) return <AppLayout><Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box></AppLayout>;
  const hasPermission = profile && ['supervisor', 'admin'].includes(profile.role);
  if (!hasPermission) return <AppLayout><Alert severity="error">No tienes permiso para ver esta página.</Alert></AppLayout>;

  return (
    <AppLayout>
      <Typography variant="h4" gutterBottom>Gestión y Seguimiento de Rutas</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2 }}>
            <TextField
                fullWidth
                label="Buscar por ID de mercaderista"
                variant="outlined"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ mb: 2 }}
            />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Mercaderista</TableCell>
                    <TableCell>Progreso</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={4} align="center"><CircularProgress /></TableCell></TableRow>
                  ) : rutas.map((ruta) => (
                    <TableRow key={ruta.id} hover>
                      <TableCell>{new Date(ruta.fecha).toLocaleDateString('es-CO')}</TableCell>
                      <TableCell>{ruta.mercaderista_id}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box sx={{ width: '100%', mr: 1 }}>
                            <LinearProgress variant="determinate" value={calculateProgress(ruta)} />
                          </Box>
                          <Box sx={{ minWidth: 35 }}>
                            <Typography variant="body2" color="text.secondary">{`${Math.round(calculateProgress(ruta))}%`}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Ver Detalles y Feedback">
                          <IconButton onClick={() => handleOpenModal(ruta)}>
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Ver en Mapa">
                          <IconButton onClick={() => {
                            setSelectedRuta(ruta);
                            setMapModalOpen(true);
                          }}>
                            <MapIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
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
                disabled={loading}
              />
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Crear Nueva Ruta</Typography>
                {/* Formulario de creación de ruta simplificado para el ejemplo */}
                <form onSubmit={handleSubmit}>
                    <TextField label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
                    <TextField label="ID Mercaderista" value={mercaderistaId} onChange={e => setMercaderistaId(e.target.value)} fullWidth sx={{ mb: 2 }} />
                    <Typography>Puntos de Venta</Typography>
                    <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto', p: 1, mb: 2 }}>
                        <FormGroup>
                            {puntos.map(p => (
                                <FormControlLabel key={p.id} control={<Checkbox checked={selectedPuntos.includes(p.id)} onChange={() => {
                                    setSelectedPuntos(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])
                                }} />} label={p.nombre} />
                            ))}
                        </FormGroup>
                    </Paper>
                    <Button type="submit" variant="contained" fullWidth disabled={isSubmitting}>Crear Ruta</Button>
                </form>
            </Paper>
        </Grid>
      </Grid>

      <Modal open={modalOpen} onClose={handleCloseModal}>
        <Box sx={modalStyle}>
          <Typography variant="h6" gutterBottom>Detalle de la Ruta</Typography>
          {loadingVisitas ? <CircularProgress /> : (
            <List sx={{ maxHeight: 400, overflow: 'auto' }}>
              {selectedRuta?.puntos_de_venta_ids.map(puntoId => {
                const punto = puntos.find(p => p.id === puntoId);
                const visita = visitas[selectedRuta.id]?.find(v => v.punto_de_venta_id === puntoId);
                const estado = visita?.estado || 'Pendiente';

                let chipColor = 'default';
                if (estado === 'Completada') chipColor = 'success';
                if (estado === 'Incidencia') chipColor = 'error';
                if (estado === 'En Progreso') chipColor = 'info';

                return (
                  <ListItem key={puntoId} divider>
                    <ListItemText
                      primary={<>{punto?.nombre} <Chip label={estado} size="small" color={chipColor} /></>}
                      secondary={visita?.observaciones ? `Observación: ${visita.observaciones}` : 'Sin feedback.'}
                    />
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>
      </Modal>

      <Modal open={mapModalOpen} onClose={() => setMapModalOpen(false)}>
        <Box sx={modalStyle}>
            <Typography variant="h6" gutterBottom>
              Mapa de la Ruta
            </Typography>
            {selectedRuta && (
              <RutaMap
                puntos={
                  selectedRuta.puntos_de_venta_ids
                    .map(id => puntos.find(p => p.id === id))
                    .filter(Boolean) // Filter out any undefined points
                }
              />
            )}
        </Box>
      </Modal>

    </AppLayout>
  );
}

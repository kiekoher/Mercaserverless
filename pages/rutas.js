import { useState, useEffect, Fragment, useCallback } from 'react';
import { useAuth } from '../context/Auth';
import {
  Box, Typography, Button, Grid, Paper, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Checkbox, FormControlLabel,
  FormGroup, Tooltip, Pagination, Alert, Modal, Chip, LinearProgress, List, ListItem, ListItemText, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, InputLabel, FormControl
} from '@mui/material';
import AppLayout from '../components/AppLayout';
import { useDebounce } from '../hooks/useDebounce';
import { useSnackbar } from 'notistack';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MapIcon from '@mui/icons-material/Map';
import SummarizeIcon from '@mui/icons-material/Summarize';
import dynamic from 'next/dynamic';
import { useAuthorization } from '../hooks/useAuthorization';
import { useCsrfFetcher } from '../lib/fetchWithCsrf';
import logger from '../lib/logger.client';

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
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const { can, role } = useAuthorization();
  const fetchWithCsrf = useCsrfFetcher();

  const [rutas, setRutas] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [visitas, setVisitas] = useState({});
  const [loading, setLoading] = useState(true);

  // Estado del modal
  const [modalOpen, setModalOpen] = useState(false);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [selectedRuta, setSelectedRuta] = useState(null);
  const [loadingVisitas, setLoadingVisitas] = useState(false);
  const [summaryContent, setSummaryContent] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Estado del formulario
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [mercaderistaId, setMercaderistaId] = useState('');
  const [selectedPuntos, setSelectedPuntos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [transportMode, setTransportMode] = useState('driving');

  const [editRutaOpen, setEditRutaOpen] = useState(false);
  const [deleteRutaOpen, setDeleteRutaOpen] = useState(false);
  const [rutaToEdit, setRutaToEdit] = useState(null);
  const [rutaToDelete, setRutaToDelete] = useState(null);
  const [editFecha, setEditFecha] = useState('');
  const [editPuntos, setEditPuntos] = useState('');

  // Paginación y búsqueda
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // State for Monthly Planner
  const [planMercaderistaId, setPlanMercaderistaId] = useState('');
  const [planStartDate, setPlanStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [planEndDate, setPlanEndDate] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [planResult, setPlanResult] = useState(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);

  const fetchVisitasForRuta = useCallback(async (rutaId) => {
    try {
        const res = await fetch(`/api/visitas?ruta_id=${rutaId}&page=1&pageSize=50`);
        if (!res.ok) return; // Fail silently
        const { data } = await res.json();
        setVisitas(prev => ({ ...prev, [rutaId]: data }));
    } catch (err) {
        // Do not show snackbar for this background fetch
        logger.error({ err }, `Failed to fetch visits for route ${rutaId}`);
    }
  }, []);

  const fetchRutas = useCallback(async () => {
    setLoading(true);
    const pageSize = 20;
    try {
      const params = new URLSearchParams({ page, pageSize, search: debouncedSearchTerm });
      const res = await fetch(`/api/rutas?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar las rutas.');
      const { data, totalCount } = await res.json();
      setTotalPages(Math.ceil(totalCount / pageSize));
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
  }, [page, debouncedSearchTerm, enqueueSnackbar, fetchVisitasForRuta]);

  const [puntoSearch, setPuntoSearch] = useState('');
  const debouncedPuntoSearch = useDebounce(puntoSearch, 500);

  const fetchPuntosDeVenta = useCallback(async () => {
    try {
      const params = new URLSearchParams({ search: debouncedPuntoSearch });
      const res = await fetch(`/api/puntos-de-venta?${params.toString()}`);
      if(!res.ok) throw new Error('Failed to fetch points of sale');
      const { data } = await res.json();
      setPuntos(data);
    } catch(err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    }
  }, [debouncedPuntoSearch, enqueueSnackbar]);

  useEffect(() => {
    if (user) {
      fetchRutas();
    }
  }, [user, fetchRutas]);

  useEffect(() => {
    if (user) {
      fetchPuntosDeVenta();
    }
  }, [user, debouncedPuntoSearch, fetchPuntosDeVenta]);

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

  const handleGenerateSummary = async (ruta) => {
    setLoadingSummary(true);
    setSummaryContent('');
    try {
      // La API ahora nos da los puntos de venta directamente en la ruta
      const routePuntos = ruta.puntos_de_venta;

      const res = await fetchWithCsrf('/api/generate-summary', {
        method: 'POST',
        body: JSON.stringify({
          fecha: ruta.fecha,
          mercaderistaId: ruta.mercaderista_id,
          puntos: routePuntos,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo generar el resumen.');
      }

      setSummaryContent(data.summary);
      setSummaryModalOpen(true);
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setLoadingSummary(false);
    }
  };

  const calculateProgress = (ruta) => {
    const visitasDeRuta = visitas[ruta.id] || [];
    // Usamos el nuevo array de objetos
    if (!ruta.puntos_de_venta || ruta.puntos_de_venta.length === 0) return 0;
    const completadas = visitasDeRuta.filter(v => v.estado === 'Completada' || v.estado === 'Incidencia').length;
    // El denominador es ahora la longitud del nuevo array
    return (completadas / ruta.puntos_de_venta.length) * 100;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
        // El cuerpo de la petición ahora usa 'pdvIds'
        const res = await fetchWithCsrf('/api/rutas', {
            method: 'POST',
            body: JSON.stringify({ fecha, mercaderistaId, pdvIds: selectedPuntos })
        });
        if (!res.ok) throw new Error('Failed to create route');
        enqueueSnackbar('Ruta creada con éxito', { variant: 'success' });
        fetchRutas(); // Refresh
        // Reset form
        setFecha(new Date().toISOString().split('T')[0]);
        setMercaderistaId('');
        setSelectedPuntos([]);
    } catch (err) {
        enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleOptimizeRoute = async () => {
    setIsOptimizing(true);
    try {
      const puntosData = selectedPuntos.map(id => {
        const p = puntos.find(pt => pt.id === id);
        return { id: p.id, direccion: p.direccion, ciudad: p.ciudad };
      });
      const res = await fetchWithCsrf('/api/optimize-route', {
        method: 'POST',
        body: JSON.stringify({ puntos: puntosData, modo_transporte: transportMode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo optimizar');
      setSelectedPuntos(data.optimizedPuntos.map(p => p.id));
      enqueueSnackbar(`Ruta optimizada para: ${transportMode}`, { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setIsOptimizing(false);
    }
  };

  const openEditRutaDialog = (ruta) => {
    setRutaToEdit(ruta);
    setEditFecha(ruta.fecha);
    // Usamos el nuevo array de objetos para obtener los IDs
    setEditPuntos(ruta.puntos_de_venta.map(p => p.id).join(','));
    setEditRutaOpen(true);
  };

  const handleEditRutaSubmit = async () => {
    try {
      const ids = editPuntos.split(',').map(n => parseInt(n.trim(), 10)).filter(Boolean);
      // El cuerpo de la petición ahora usa 'pdvIds'
      const res = await fetchWithCsrf('/api/rutas', {
        method: 'PUT',
        body: JSON.stringify({ id: rutaToEdit.id, fecha: editFecha, mercaderistaId: rutaToEdit.mercaderista_id, pdvIds: ids })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al actualizar');
      }
      enqueueSnackbar('Ruta actualizada', { variant: 'success' });
      setEditRutaOpen(false);
      fetchRutas();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    }
  };

  const openDeleteRutaDialog = (ruta) => {
    setRutaToDelete(ruta);
    setDeleteRutaOpen(true);
  };

  const handleDeleteRutaConfirm = async () => {
    try {
      const res = await fetchWithCsrf(`/api/rutas?id=${rutaToDelete.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar');
      }
      enqueueSnackbar('Ruta eliminada', { variant: 'success' });
      setDeleteRutaOpen(false);
      fetchRutas();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    }
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    if (!planMercaderistaId || !planStartDate || !planEndDate) {
        enqueueSnackbar('Por favor, complete todos los campos del planificador.', { variant: 'warning' });
        return;
    }
    setIsPlanning(true);
    setPlanResult(null);
    try {
        const res = await fetchWithCsrf('/api/planificar-rutas', {
            method: 'POST',
            body: JSON.stringify({
                mercaderistaId: planMercaderistaId,
                startDate: planStartDate,
                endDate: planEndDate
            })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Error al generar la planificación.');
        }
        setPlanResult(data.plan);
        setPlanModalOpen(true);
        enqueueSnackbar(data.message, { variant: 'success' });
    } catch (err) {
        enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
        setIsPlanning(false);
    }
  };

  if (!user || !role) return <AppLayout><Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box></AppLayout>;
  if (!can(['supervisor', 'admin'])) return <AppLayout><Alert severity="error">No tienes permiso para ver esta página.</Alert></AppLayout>;

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
                      <TableCell>{new Date(ruta.fecha + 'T00:00:00').toLocaleDateString('es-CO', { timeZone: 'UTC' })}</TableCell>
                      <TableCell>{ruta.mercaderista_name || ruta.mercaderista_id}</TableCell>
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
                        <Tooltip title="Generar Resumen IA">
                          <span>
                            <IconButton
                              onClick={() => handleGenerateSummary(ruta)}
                              disabled={loadingSummary}
                            >
                              {loadingSummary && selectedRuta?.id === ruta.id ? <CircularProgress size={24} /> : <SummarizeIcon />}
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Button size="small" onClick={() => openEditRutaDialog(ruta)}>Editar</Button>
                        <Button size="small" color="error" onClick={() => openDeleteRutaDialog(ruta)}>Eliminar</Button>
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
            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Planificador Mensual</Typography>
                <form onSubmit={handlePlanSubmit}>
                    <TextField label="ID Mercaderista" value={planMercaderistaId} onChange={e => setPlanMercaderistaId(e.target.value)} required fullWidth sx={{ mb: 2 }} />
                    <TextField label="Fecha de Inicio" type="date" value={planStartDate} onChange={e => setPlanStartDate(e.target.value)} InputLabelProps={{ shrink: true }} required fullWidth sx={{ mb: 2 }} />
                    <TextField label="Fecha de Fin" type="date" value={planEndDate} onChange={e => setPlanEndDate(e.target.value)} InputLabelProps={{ shrink: true }} required fullWidth sx={{ mb: 2 }} />
                    <Button type="submit" variant="contained" color="primary" fullWidth disabled={isPlanning}>
                        {isPlanning ? <CircularProgress size={24} /> : 'Generar Plan'}
                    </Button>
                </form>
            </Paper>

            <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Crear Nueva Ruta (Manual)</Typography>
                {/* Formulario de creación de ruta simplificado para el ejemplo */}
                <form onSubmit={handleSubmit}>
                    <TextField name="fecha" label="Fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
                    <TextField name="mercaderistaId" label="ID Mercaderista" value={mercaderistaId} onChange={e => setMercaderistaId(e.target.value)} fullWidth sx={{ mb: 2 }} />
                      <Typography>Puntos de Venta</Typography>
                      <TextField name="puntoSearch" label="Buscar punto" value={puntoSearch} onChange={e => setPuntoSearch(e.target.value)} fullWidth sx={{ mb: 1 }} />
                      <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto', p: 1, mb: 2 }}>
                          <FormGroup>
                              {puntos.map(p => (
                                  <FormControlLabel key={p.id} control={<Checkbox checked={selectedPuntos.includes(p.id)} onChange={() => {
                                      setSelectedPuntos(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])
                                  }} />} label={p.nombre} />
                              ))}
                          </FormGroup>
                      </Paper>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel id="transport-mode-label">Modo de Transporte</InputLabel>
                        <Select
                            labelId="transport-mode-label"
                            value={transportMode}
                            label="Modo de Transporte"
                            onChange={(e) => setTransportMode(e.target.value)}
                        >
                            <MenuItem value="driving">Vehículo</MenuItem>
                            <MenuItem value="walking">A pie</MenuItem>
                            <MenuItem value="transit">Transporte Público</MenuItem>
                        </Select>
                    </FormControl>
                    <Button onClick={handleOptimizeRoute} variant="outlined" fullWidth disabled={isOptimizing || selectedPuntos.length < 2} sx={{ mb: 2 }}>
                      {isOptimizing ? 'Optimizando...' : 'Optimizar'}
                    </Button>
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
              {selectedRuta?.puntos_de_venta.map(punto => {
                const visita = visitas[selectedRuta.id]?.find(v => v.punto_de_venta_id === punto.id);
                const estado = visita?.estado || 'Pendiente';

                let chipColor = 'default';
                if (estado === 'Completada') chipColor = 'success';
                if (estado === 'Incidencia') chipColor = 'error';
                if (estado === 'En Progreso') chipColor = 'info';

                return (
                  <ListItem key={punto.id} divider>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1">{punto.nombre}</Typography>
                          {punto.tipologia && <Chip label={punto.tipologia} size="small" />}
                          <Chip label={estado} size="small" color={chipColor} />
                        </Box>
                      }
                      secondary={`Frec: ${punto.frecuencia_mensual || 'N/A'} | T. Serv: ${punto.minutos_servicio || 'N/A'} min. | ${visita?.observaciones ? `Obs: ${visita.observaciones}` : 'Sin feedback.'}`}
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
                puntos={selectedRuta.puntos_de_venta}
              />
            )}
        </Box>
      </Modal>

      <Modal open={summaryModalOpen} onClose={() => setSummaryModalOpen(false)}>
        <Box sx={modalStyle}>
          <Typography variant="h6" gutterBottom>
            Resumen de la Ruta Generado por IA
          </Typography>
          {loadingSummary ? <CircularProgress /> : (
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {summaryContent}
            </Typography>
          )}
          <Button onClick={() => setSummaryModalOpen(false)} sx={{ mt: 2 }}>
            Cerrar
          </Button>
        </Box>
      </Modal>

      <Dialog open={editRutaOpen} onClose={() => setEditRutaOpen(false)}>
        <DialogTitle>Editar Ruta</DialogTitle>
        <DialogContent>
          <TextField margin="dense" label="Fecha" type="date" fullWidth value={editFecha} onChange={e => setEditFecha(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField margin="dense" label="IDs de Puntos de Venta" fullWidth value={editPuntos} onChange={e => setEditPuntos(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRutaOpen(false)}>Cancelar</Button>
          <Button onClick={handleEditRutaSubmit}>Guardar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteRutaOpen} onClose={() => setDeleteRutaOpen(false)}>
        <DialogTitle>Eliminar Ruta</DialogTitle>
        <DialogActions>
          <Button onClick={() => setDeleteRutaOpen(false)}>Cancelar</Button>
          <Button color="error" onClick={handleDeleteRutaConfirm}>Eliminar</Button>
        </DialogActions>
      </Dialog>

      <Modal open={planModalOpen} onClose={() => setPlanModalOpen(false)}>
        <Box sx={{...modalStyle, width: { xs: '95%', md: 800 }, maxHeight: '90vh', overflowY: 'auto' }}>
            <Typography variant="h6" gutterBottom>Resultado de la Planificación</Typography>
            {planResult ? (
                <Box>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                        <Grid item xs={6} sm={3}><Chip label="Periodo" color="primary" sx={{width: '100%'}} /><Typography variant="body2" align="center">{planResult.period.startDate} al {planResult.period.endDate}</Typography></Grid>
                        <Grid item xs={6} sm={3}><Chip label="Visitas Planificadas" color="primary" sx={{width: '100%'}} /><Typography variant="body2" align="center">{planResult.summary.totalVisitsPlanned} / {planResult.summary.totalVisitsToPlan}</Typography></Grid>
                        <Grid item xs={6} sm={3}><Chip label="Horas Estimadas" color="primary" sx={{width: '100%'}} /><Typography variant="body2" align="center">{planResult.summary.estimatedTotalHours}</Typography></Grid>
                        <Grid item xs={6} sm={3}><Chip label="Días Laborables" color="primary" sx={{width: '100%'}} /><Typography variant="body2" align="center">{planResult.summary.workingDays}</Typography></Grid>
                    </Grid>
                    <Typography variant="subtitle1" sx={{mt: 2, mb: 1}}>Rutas Diarias Generadas</Typography>
                    <Box sx={{ maxHeight: 400, overflow: 'auto', border: '1px solid #eee', p: 1, borderRadius: 1 }}>
                      {planResult.dailyRoutes && planResult.dailyRoutes.length > 0 ? (
                        <List dense>
                          {planResult.dailyRoutes.map(route => (
                            <ListItem key={route.date} divider>
                              <ListItemText
                                primary={<Typography variant="body1"><strong>{new Date(route.date + 'T00:00:00Z').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</strong> ({route.totalMinutes} min)</Typography>}
                                secondary={
                                  <List dense sx={{ pl: 2 }}>
                                    {route.points.map(p => (
                                      <ListItemText key={p.visit_id} primary={`${p.nombre}`} secondary={`(ID: ${p.id}, T.Serv: ${p.minutos_servicio} min)`} />
                                    ))}
                                  </List>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        <Typography variant="body2" color="text.secondary" align="center" sx={{p: 2}}>No se generaron rutas. Verifique la capacidad y los datos de los puntos de venta.</Typography>
                      )}
                    </Box>
                </Box>
            ) : <CircularProgress />}
             <Button onClick={() => setPlanModalOpen(false)} sx={{ mt: 2 }}>
                Cerrar
            </Button>
        </Box>
      </Modal>

    </AppLayout>
  );
}

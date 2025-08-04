import { useState, useEffect, Fragment, useCallback } from 'react';
import { useAuth } from '../context/Auth';
import {
  Box, Typography, Button, Grid, Paper, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Checkbox, FormControlLabel,
  FormGroup, Tooltip, Pagination, Alert, Modal, Chip, LinearProgress
} from '@mui/material';
import AppLayout from '../components/AppLayout';
import { useDebounce } from '../hooks/useDebounce';
import { useSnackbar } from 'notistack';
import VisibilityIcon from '@mui/icons-material/Visibility';

// Estilo para el Modal de detalles
const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 600,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

export default function RutasPage() {
  const { user, profile } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [rutas, setRutas] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [visitas, setVisitas] = useState({}); // Almacenará las visitas por ruta_id
  const [loading, setLoading] = useState(true);

  // Estado para el modal de detalles de la ruta
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRuta, setSelectedRuta] = useState(null);

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

  const fetchAllPuntosDeVenta = useCallback(async () => { /* ... (código sin cambios) ... */ }, [enqueueSnackbar]);

  useEffect(() => {
    if(user) {
      fetchRutas();
      fetchAllPuntosDeVenta();
    }
  }, [user, fetchRutas, fetchAllPuntosDeVenta]);

  const handleOpenModal = async (ruta) => {
    setSelectedRuta(ruta);
    try {
      const res = await fetch(`/api/visitas?ruta_id=${ruta.id}`);
      if (!res.ok) throw new Error('No se pudo cargar el detalle de las visitas.');
      const data = await res.json();
      setVisitas(prev => ({ ...prev, [ruta.id]: data }));
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    }
    setModalOpen(true);
  };
  
  const handleCloseModal = () => setModalOpen(false);

  const calculateProgress = (ruta) => {
    const visitasDeRuta = visitas[ruta.id] || [];
    const completadas = visitasDeRuta.filter(v => v.estado === 'Completada' || v.estado === 'Incidencia').length;
    return (completadas / ruta.puntosDeVentaIds.length) * 100;
  };

  // ... (resto de funciones handleOptimizeRoute, handleSubmit, handleGenerateSummary sin cambios)

  if (!user || !profile) return <AppLayout><Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box></AppLayout>;
  const hasPermission = profile && ['supervisor', 'admin'].includes(profile.role);
  if (!hasPermission) return <AppLayout><Alert severity="error">No tienes permiso para ver esta página.</Alert></AppLayout>;

  return (
    <AppLayout>
      <Typography variant="h4" gutterBottom>Gestión y Seguimiento de Rutas</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell>Mercaderista</TableCell>
                    <TableCell>Progreso</TableCell>
                    <TableCell>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={4} align="center"><CircularProgress /></TableCell></TableRow>
                  ) : rutas.map((ruta) => (
                    <TableRow key={ruta.id}>
                      <TableCell>{ruta.fecha}</TableCell>
                      <TableCell>{ruta.mercaderistaId}</TableCell>
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
                      <TableCell>
                        <Tooltip title="Ver Detalles y Feedback">
                          <IconButton onClick={() => handleOpenModal(ruta)}>
                            <VisibilityIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {/* ... (Paginación sin cambios) ... */}
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
            {/* ... (Formulario de creación de ruta sin cambios) ... */}
        </Grid>
      </Grid>

      <Modal open={modalOpen} onClose={handleCloseModal}>
        <Box sx={modalStyle}>
          <Typography variant="h6">Detalle de la Ruta</Typography>
          {selectedRuta && (
            <List>
              {selectedRuta.puntosDeVentaIds.map(puntoId => {
                const punto = puntos.find(p => p.id === puntoId);
                const visita = visitas[selectedRuta.id]?.find(v => v.punto_de_venta_id === puntoId);
                const estado = visita?.estado || 'Pendiente';

                return (
                  <ListItem key={puntoId} divider>
                    <ListItemText
                      primary={<>{punto?.nombre} <Chip label={estado} size="small" color={estado === 'Completada' ? 'success' : 'default'} /></>}
                      secondary={visita?.observaciones || 'Sin feedback.'}
                    />
                  </ListItem>
                );
              })}
            </List>
          )}
        </Box>
      </Modal>

    </AppLayout>
  );
}

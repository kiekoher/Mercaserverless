import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/Auth';
import { useRouter } from 'next/router';
import {
  Typography, CircularProgress, Alert, Box, List, ListItem, ListItemText, ListItemAvatar,
  Avatar, IconButton, Tooltip, Button, Modal, TextField, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import DirectionsIcon from '@mui/icons-material/Directions';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AppLayout from '../components/AppLayout';
import { useSnackbar } from 'notistack';
import { useCsrfFetcher } from '../lib/fetchWithCsrf';

// Estilo para el Modal de feedback
const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  border: '1px solid #ddd',
  borderRadius: '8px',
  boxShadow: 24,
  p: 4,
};

export default function MiRutaPage() {
  const { user, profile } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const router = useRouter();
  const fetchWithCsrf = useCsrfFetcher();
  
  const [ruta, setRuta] = useState(null);
  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Estado para el modal de feedback
  const [modalOpen, setModalOpen] = useState(false);
  const [currentVisita, setCurrentVisita] = useState(null);
  const [feedback, setFeedback] = useState({ estado: 'Completada', observaciones: '' });

  const fetchRutaYVisitas = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // Obtener la ruta
      const resRuta = await fetch('/api/mi-ruta');
      if (resRuta.status === 404) {
        setRuta(null);
        throw new Error('No tienes una ruta asignada para hoy.');
      }
      if (!resRuta.ok) throw new Error('Error al cargar la ruta.');
      const dataRuta = await resRuta.json();
      setRuta(dataRuta);

      // Si hay ruta, obtener las visitas asociadas
      if (dataRuta && dataRuta.id) {
        const resVisitas = await fetch(`/api/visitas?ruta_id=${dataRuta.id}&page=1&pageSize=50`);
        if (!resVisitas.ok) throw new Error('Error al cargar el estado de las visitas.');
        const { data: dataVisitas } = await resVisitas.json();
        setVisitas(dataVisitas);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRutaYVisitas();
  }, [fetchRutaYVisitas]);

  const handleCheckIn = async (puntoId) => {
    try {
      const res = await fetchWithCsrf('/api/visitas', {
        method: 'POST',
        body: JSON.stringify({ ruta_id: ruta.id, punto_de_venta_id: puntoId }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'No se pudo hacer el check-in.');
      }
      enqueueSnackbar('Check-in realizado con éxito', { variant: 'success' });
      fetchRutaYVisitas(); // Recargar datos para reflejar el nuevo estado
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    }
  };
  
  const handleOpenModal = (visita) => {
    setCurrentVisita(visita);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setCurrentVisita(null);
    setFeedback({ estado: 'Completada', observaciones: '' });
  };
  
  const handleCheckOut = async () => {
    if (!currentVisita) return;
    try {
      const res = await fetchWithCsrf('/api/visitas', {
          method: 'PUT',
          body: JSON.stringify({ visita_id: currentVisita.id, ...feedback }),
      });
      if (!res.ok) {
         const errData = await res.json();
        throw new Error(errData.error || 'No se pudo enviar el feedback.');
      }
      enqueueSnackbar('Check-out y feedback enviados con éxito', { variant: 'success' });
      handleCloseModal();
      fetchRutaYVisitas(); // Recargar datos
    } catch (err) {
        enqueueSnackbar(err.message, { variant: 'error' });
    }
  };

  const getPuntoStatus = (puntoId) => {
    return visitas.find(v => v.punto_de_venta_id === puntoId);
  };

  const getGoogleMapsLink = (address) => {
    if (!address) return '#';
    const encodedAddress = encodeURIComponent(address);
    return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  };

  if (loading) {
    return <AppLayout><Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box></AppLayout>;
  }

  if (profile?.role !== 'mercaderista') {
    return <AppLayout><Alert severity="error">No tienes permiso para ver esta página.</Alert></AppLayout>;
  }

  return (
    <AppLayout>
      <Typography variant="h4" gutterBottom>Tu Ruta para Hoy</Typography>
      <Typography variant="subtitle1" gutterBottom>
        Fecha: {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </Typography>

      {error && <Alert severity="warning" sx={{ mt: 2 }}>{error}</Alert>}

      {!error && ruta && (
        <List sx={{ width: '100%', bgcolor: 'background.paper', mt: 2 }}>
          {ruta.puntos && ruta.puntos.length > 0 ? (
            ruta.puntos.map((punto, index) => {
              const visita = getPuntoStatus(punto.id);
              const status = visita?.estado || 'Pendiente';

              return (
                <ListItem
                  key={punto.id}
                  divider
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {status === 'Pendiente' && <Button size="small" variant="contained" onClick={() => handleCheckIn(punto.id)}>Check-in</Button>}
                      {status === 'En Progreso' && <Button size="small" variant="outlined" onClick={() => handleOpenModal(visita)}>Check-out</Button>}
                      <Tooltip title="Abrir en Google Maps">
                        <IconButton
                          edge="end"
                          aria-label="directions"
                          href={getGoogleMapsLink(punto.direccion)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <DirectionsIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: status === 'Completada' || status === 'Incidencia' ? 'success.main' : 'primary.main' }}>
                      {status === 'Completada' || status === 'Incidencia' ? <CheckCircleOutlineIcon /> : index + 1}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={<Typography variant="h6">{punto.nombre}</Typography>}
                    secondary={punto.direccion || 'Dirección no disponible'}
                  />
                </ListItem>
              );
            })
          ) : (
             <Alert severity="info">Tu ruta de hoy no tiene puntos de venta asignados.</Alert>
          )}
        </List>
      )}

      <Modal open={modalOpen} onClose={handleCloseModal}>
        <Box sx={modalStyle}>
          <Typography variant="h6" component="h2">Reportar Visita</Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>Finaliza tu visita y añade tus observaciones.</Typography>
          <FormControl fullWidth margin="normal">
            <InputLabel>Estado Final</InputLabel>
            <Select
              value={feedback.estado}
              label="Estado Final"
              onChange={(e) => setFeedback(prev => ({ ...prev, estado: e.target.value }))}
            >
              <MenuItem value="Completada">Completada</MenuItem>
              <MenuItem value="Incidencia">Incidencia</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Observaciones"
            multiline
            rows={4}
            fullWidth
            margin="normal"
            value={feedback.observaciones}
            onChange={(e) => setFeedback(prev => ({ ...prev, observaciones: e.target.value }))}
          />
          <Button variant="contained" onClick={handleCheckOut} sx={{ mt: 2, width: '100%' }}>Enviar y Finalizar</Button>
        </Box>
      </Modal>
    </AppLayout>
  );
}

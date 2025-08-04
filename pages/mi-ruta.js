import { useState, useEffect } from 'react';
import { useAuth } from '../context/Auth';
import { useRouter } from 'next/router';
import {
  Typography, CircularProgress, Alert, Box, List,
  ListItem, ListItemText, ListItemAvatar, Avatar, IconButton, Tooltip
} from '@mui/material';
import DirectionsIcon from '@mui/icons-material/Directions'; // Importar el ícono
import AppLayout from '../components/AppLayout';

export default function MiRutaPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [ruta, setRuta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user && process.env.NODE_ENV !== 'test') {
      router.push('/login');
      return;
    }

    const fetchRuta = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/mi-ruta');
        if (res.status === 404) {
          setError('No tienes una ruta asignada para hoy.');
          return;
        }
        if (!res.ok) throw new Error('Error al cargar la ruta.');
        const data = await res.json();
        setRuta(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchRuta();
    }
  }, [user, router]);
  
  // **MEJORA: Función para generar el enlace de Google Maps**
  const getGoogleMapsLink = (address) => {
    const encodedAddress = encodeURIComponent(address);
    return `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
  };

  if (!user || !profile) {
    return <AppLayout><Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box></AppLayout>;
  }
  
  if (loading) {
    return <AppLayout><Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box></AppLayout>;
  }

  if (profile.role !== 'mercaderista') {
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
            ruta.puntos.map((punto, index) => (
              <ListItem 
                key={punto.id} 
                divider
                secondaryAction={
                  // **MEJORA: Botón con enlace a Google Maps**
                  <Tooltip title="Abrir en Google Maps">
                    <IconButton 
                      edge="end" 
                      aria-label="directions"
                      href={getGoogleMapsLink(punto.direccion)}
                      target="_blank" // Abrir en una nueva pestaña
                      rel="noopener noreferrer"
                    >
                      <DirectionsIcon />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    {index + 1}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={<Typography variant="h6">{punto.nombre}</Typography>}
                  secondary={punto.direccion || 'Dirección no disponible'}
                />
              </ListItem>
            ))
          ) : (
             <Alert severity="info">Tu ruta de hoy no tiene puntos de venta asignados.</Alert>
          )}
        </List>
      )}
    </AppLayout>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '../context/Auth';
import { useRouter } from 'next/router';
import {
  Typography, CircularProgress, Alert, Box, List,
  ListItem, ListItemText, ListItemAvatar, Avatar
} from '@mui/material';
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

  if (!user || !profile || loading) {
    return (
      <AppLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </AppLayout>
    );
  }

  if (profile.role !== 'mercaderista') {
    return <AppLayout><Alert severity="error">No tienes permiso para ver esta página.</Alert></AppLayout>
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
          {ruta.puntos.map((punto, index) => (
            <ListItem key={punto.id} divider>
              <ListItemAvatar>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  {index + 1}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={<Typography variant="h6">{punto.nombre}</Typography>}
                secondary={punto.direccion}
              />
            </ListItem>
          ))}
        </List>
      )}
    </AppLayout>
  );
}

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../context/Auth';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Card,
  CardContent,
  CardActions,
  Grid
} from '@mui/material';
import Link from 'next/link';
import AppLayout from '../components/AppLayout'; // Import the shared layout

const SupervisorDashboard = () => (
  <Grid container spacing={3}>
    <Grid item xs={12} md={4}>
      <Card>
        <CardContent>
          <Typography variant="h5" component="div">Gestionar Puntos de Venta</Typography>
          <Typography sx={{ mt: 1.5 }} color="text.secondary">Añade, edita o visualiza los puntos de venta.</Typography>
        </CardContent>
        <CardActions>
          <Link href="/puntos-de-venta" passHref><Button size="small">Ir a Puntos de Venta</Button></Link>
        </CardActions>
      </Card>
    </Grid>
    <Grid item xs={12} md={4}>
      <Card>
        <CardContent>
          <Typography variant="h5" component="div">Gestionar Rutas</Typography>
          <Typography sx={{ mt: 1.5 }} color="text.secondary">Crea y asigna nuevas rutas para los mercaderistas.</Typography>
        </CardContent>
        <CardActions>
          <Link href="/rutas" passHref><Button size="small">Ir a Rutas</Button></Link>
        </CardActions>
      </Card>
    </Grid>
    <Grid item xs={12} md={4}>
      <Card>
        <CardContent>
          <Typography variant="h5" component="div">Ver Dashboard</Typography>
          <Typography sx={{ mt: 1.5 }} color="text.secondary">Analiza las métricas y el rendimiento de la operación.</Typography>
        </CardContent>
        <CardActions>
          <Link href="/dashboard" passHref><Button size="small">Ir al Dashboard</Button></Link>
        </CardActions>
      </Card>
    </Grid>
  </Grid>
);

const MercaderistaDashboard = () => (
  <Card>
    <CardContent>
      <Typography variant="h5" component="div">Mi Ruta del Día</Typography>
      <Typography sx={{ mt: 1.5 }} color="text.secondary">Consulta los puntos de venta que tienes asignados para hoy.</Typography>
    </CardContent>
    <CardActions>
      <Link href="/mi-ruta" passHref><Button size="small">Ver Mi Ruta</Button></Link>
    </CardActions>
  </Card>
);

export default function HomePage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect to login only if not in a test environment
    if (!user && process.env.NODE_ENV !== 'test') {
      router.push('/login');
    }
  }, [user, router]);

  if (!user || !profile) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <AppLayout>
      <Typography variant="h4" sx={{ mb: 4 }}>
        Panel Principal
      </Typography>
      {profile.role === 'supervisor' ? <SupervisorDashboard /> : <MercaderistaDashboard />}
    </AppLayout>
  );
}

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
  Grid,
  Divider
} from '@mui/material';
import Link from 'next/link';
import AppLayout from '../components/AppLayout';

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

const AdminDashboard = () => (
  <Grid container spacing={3}>
     <Grid item xs={12} md={4}>
      <Card>
        <CardContent>
          <Typography variant="h5" component="div">Gestionar Usuarios</Typography>
          <Typography sx={{ mt: 1.5 }} color="text.secondary">Asigna roles y gestiona los usuarios del sistema.</Typography>
        </CardContent>
        <CardActions>
          <Link href="/admin/users" passHref><Button size="small">Ir a Usuarios</Button></Link>
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

// **MEJORA: Se añaden títulos para mayor claridad en el rol de admin**
const renderDashboardByRole = (role) => {
  switch (role) {
    case 'admin':
      return (
        <>
          <Typography variant="h5" sx={{ mb: 2 }}>Panel de Administrador</Typography>
          <AdminDashboard />
          <Divider sx={{ my: 4 }} />
          <Typography variant="h5" sx={{ mb: 2 }}>Panel de Supervisor</Typography>
          <SupervisorDashboard />
        </>
      );
    case 'supervisor':
      return <SupervisorDashboard />;
    case 'mercaderista':
      return <MercaderistaDashboard />;
    default:
      return <Typography>Rol no reconocido. Contacta al administrador.</Typography>;
  }
}

export default function HomePage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user && process.env.NODE_ENV !== 'test') {
      router.push('/login');
    }
  }, [user, router]);

  if (!user || !profile) {
    // **MEJORA: Usar el layout compartido para mantener la barra de navegación visible durante la carga**
    return (
      <AppLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <CircularProgress />
        </Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Typography variant="h4" sx={{ mb: 4 }}>
        Panel Principal
      </Typography>
      {renderDashboardByRole(profile.role)}
    </AppLayout>
  );
}

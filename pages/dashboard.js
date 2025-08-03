import { useState, useEffect } from 'react';
import { useAuth } from '../context/Auth';
import { useRouter } from 'next/router';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend,
} from 'chart.js';
import {
  Typography, CircularProgress, Alert, Box, Grid, Paper
} from '@mui/material';
import AppLayout from '../components/AppLayout';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user && process.env.NODE_ENV !== 'test') {
      router.push('/login');
      return;
    }
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/dashboard-stats');
        if (!res.ok) throw new Error('Failed to fetch stats');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if(user) fetchStats();
  }, [user, router]);

  const chartData = {
    labels: stats?.rutas_por_mercaderista?.map(item => item.mercaderista) || [],
    datasets: [
      {
        label: 'Total de Rutas Asignadas',
        data: stats?.rutas_por_mercaderista?.map(item => item.total_rutas) || [],
        backgroundColor: 'rgba(85, 108, 214, 0.6)',
        borderColor: 'rgba(85, 108, 214, 1)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: 'Rendimiento por Mercaderista' },
    },
  };

  if (!user || !profile || loading) {
    return (
      <AppLayout>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      </AppLayout>
    );
  }

  if (profile.role !== 'supervisor') {
    return <AppLayout><Alert severity="error">No tienes permiso para ver esta página.</Alert></AppLayout>
  }

  return (
    <AppLayout>
      <Typography variant="h4" gutterBottom>Dashboard de Analítica</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!error && stats && (
        <>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">Total de Rutas</Typography>
                <Typography variant="h3" component="p" sx={{ fontWeight: 'bold' }}>{stats.total_rutas ?? 0}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary">Total Puntos Visitados</Typography>
                <Typography variant="h3" component="p" sx={{ fontWeight: 'bold' }}>{stats.total_puntos_visitados ?? 0}</Typography>
              </Paper>
            </Grid>
          </Grid>

          <Typography variant="h5" gutterBottom>Desglose de Rutas</Typography>
          <Paper sx={{ p: 2 }}>
            <Bar options={chartOptions} data={chartData} />
          </Paper>
        </>
      )}
    </AppLayout>
  );
}

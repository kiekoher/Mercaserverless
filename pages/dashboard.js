import { useState, useEffect } from 'react';
import { useAuth } from '../context/Auth';
import {
  Box, Typography, Button, Paper, CircularProgress, Alert, Grid, Card, CardContent
} from '@mui/material';
import AppLayout from '../components/AppLayout';
import { useSnackbar } from 'notistack';
import fetchWithCsrf from '../lib/fetchWithCsrf';

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const res = await fetch('/api/dashboard-stats');
        if (!res.ok) throw new Error('No se pudieron cargar las estadísticas.');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        enqueueSnackbar(err.message, { variant: 'error' });
      } finally {
        setLoadingStats(false);
      }
    };

    if (profile?.role === 'supervisor' || profile?.role === 'admin') {
      fetchStats();
    }
  }, [profile, enqueueSnackbar]);

  const handleGenerateInsights = async () => {
    setLoadingInsights(true);
    setInsights(null);
    try {
      // For this example, we'll analyze the first route found.
      // A real implementation might let the user select a date range.
      const routesRes = await fetch('/api/rutas');
      const routes = await routesRes.json();
      if (!routes || routes.length === 0) {
        enqueueSnackbar('No hay rutas para analizar.', { variant: 'warning' });
        return;
      }

      const rutaId = routes[0].id; // Analyze the most recent route

      const res = await fetchWithCsrf('/api/generate-insights', {
        method: 'POST',
        body: JSON.stringify({ rutaId }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al generar el análisis.');
      }

      const data = await res.json();
      setInsights(data);
      enqueueSnackbar('Análisis generado con éxito.', { variant: 'success' });

    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setLoadingInsights(false);
    }
  };

  if (!profile) {
    return <AppLayout><CircularProgress /></AppLayout>;
  }

  const hasPermission = profile && ['supervisor', 'admin'].includes(profile.role);
  if (!hasPermission) {
    return <AppLayout><Alert severity="error">No tienes permiso para ver esta página.</Alert></AppLayout>;
  }

  return (
    <AppLayout>
      <Typography variant="h4" gutterBottom>Dashboard de Operaciones</Typography>

      {loadingStats ? <CircularProgress /> : stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">Rutas Totales</Typography>
                <Typography variant="h3">{stats.total_rutas}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6">Puntos de Venta Visitados (Total)</Typography>
                <Typography variant="h3">{stats.total_puntos_visitados}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Paper sx={{ p: 2 }}>
        <Typography variant="h5" gutterBottom>Insights de la Operación por IA</Typography>
        <Button
          variant="contained"
          onClick={handleGenerateInsights}
          disabled={loadingInsights}
        >
          {loadingInsights ? <CircularProgress size={24} /> : 'Analizar Última Ruta'}
        </Button>

        {insights && (
          <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1, whiteSpace: 'pre-wrap' }}>
            <Typography variant="body1"><strong>KPI:</strong> {insights.kpi}</Typography>
            <Typography variant="body1"><strong>Insight:</strong> {insights.insight}</Typography>
            <Typography variant="body1"><strong>Observación:</strong> {insights.observation}</Typography>
            <Typography variant="body1"><strong>Recomendación:</strong> {insights.recommendation}</Typography>
          </Box>
        )}
      </Paper>
    </AppLayout>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '../context/Auth';
import {
  Box, Typography, Button, Paper, CircularProgress, Alert, Grid, Card, CardContent
} from '@mui/material';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import AppLayout from '../components/AppLayout';
import { useSnackbar } from 'notistack';
import { useCsrfFetcher } from '../lib/fetchWithCsrf';

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const fetchWithCsrf = useCsrfFetcher();

  ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
  );

  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState(null);
  const [projectionData, setProjectionData] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingProjections, setLoadingProjections] = useState(true);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoadingStats(true);
      setLoadingProjections(true);
      try {
        // Fetch existing stats
        const statsRes = await fetch('/api/dashboard-stats');
        if (!statsRes.ok) throw new Error('No se pudieron cargar las estadísticas.');
        const statsData = await statsRes.json();
        setStats(statsData);

        // Fetch new projection data
        const projectionsRes = await fetch('/api/dashboard-projections');
        if (!projectionsRes.ok) throw new Error('No se pudieron cargar las proyecciones.');
        const projectionsData = await projectionsRes.json();
        setProjectionData(projectionsData);

      } catch (err) {
        enqueueSnackbar(err.message, { variant: 'error' });
      } finally {
        setLoadingStats(false);
        setLoadingProjections(false);
      }
    };

    if (profile?.role === 'supervisor' || profile?.role === 'admin') {
      fetchAllData();
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
        <Grid container spacing={3} sx={{ mb: 2 }}>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6">Rutas Totales</Typography>
                <Typography variant="h3">{stats.total_rutas}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="h6">Puntos Visitados</Typography>
                <Typography variant="h3">{stats.total_puntos_visitados}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>Proyecciones y Rendimiento</Typography>
      {loadingProjections ? <CircularProgress /> : (projectionData && projectionData.workload && projectionData.frequency) && (
          <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} md={8}>
                  <Card>
                      <CardContent>
                          <Typography variant="h6">Carga de Trabajo Semanal (Horas)</Typography>
                          <Bar
                              data={{
                                  labels: projectionData.workload.map(w => w.mercaderista),
                                  datasets: [{
                                      label: 'Horas Asignadas',
                                      data: projectionData.workload.map(w => w.hours),
                                      backgroundColor: projectionData.workload.map(w => w.hours > 40 ? '#d32f2f' : 'rgba(75, 192, 192, 0.6)'),
                                  }]
                              }}
                              options={{
                                  scales: { y: { beginAtZero: true, max: 50 } },
                                  plugins: { legend: { display: false } }
                              }}
                          />
                      </CardContent>
                  </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                  <Card>
                      <CardContent>
                          <Typography variant="h6">Cumplimiento de Frecuencia (Mensual)</Typography>
                          <Typography variant="h3" color="primary">{projectionData.frequency.percentage}%</Typography>
                          <Typography variant="body1">
                              {projectionData.frequency.planned} de {projectionData.frequency.required} visitas planificadas.
                          </Typography>
                      </CardContent>
                  </Card>
              </Grid>
          </Grid>
      )}

      <Paper sx={{ p: 2, mt: 4 }}>
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

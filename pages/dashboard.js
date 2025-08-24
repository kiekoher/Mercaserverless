import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/Auth';
import {
  Box, Typography, Button, Paper, CircularProgress, Alert, Grid, Card, CardContent,
  TextField, Select, MenuItem, FormControl, InputLabel
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
  const [projectionData, setProjectionData] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingProjections, setLoadingProjections] = useState(true);

  // State for the new Summary Generator
  const [mercaderistas, setMercaderistas] = useState([]);
  const [selectedMercaderista, setSelectedMercaderista] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  const fetchMercaderistas = useCallback(async () => {
    try {
      const res = await fetch('/api/users?role=mercaderista');
      if (!res.ok) throw new Error('No se pudieron cargar los mercaderistas.');
      const { data } = await res.json();
      setMercaderistas(data);
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    }
  }, [enqueueSnackbar]);

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
      fetchMercaderistas();
    }
  }, [profile, enqueueSnackbar, fetchMercaderistas]);

  const handleGenerateSummary = async () => {
    if (!startDate || !endDate) {
      setSummaryError('Por favor, selecciona una fecha de inicio y fin.');
      return;
    }
    setLoadingSummary(true);
    setSummary('');
    setSummaryError('');

    try {
      const body = {
        fecha_inicio: startDate,
        fecha_fin: endDate,
        ...(selectedMercaderista && { mercaderista_id: selectedMercaderista }),
      };

      const res = await fetchWithCsrf('/api/generate-summary', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Error al generar el resumen.');
      }

      setSummary(data.summary);
      enqueueSnackbar('Resumen generado con éxito.', { variant: 'success' });
    } catch (err) {
      setSummaryError(err.message);
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setLoadingSummary(false);
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
        <Typography variant="h5" gutterBottom>Asistente de IA: Resumen de Operaciones</Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Fecha de Inicio"
              type="date"
              fullWidth
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Fecha de Fin"
              type="date"
              fullWidth
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth>
              <InputLabel id="mercaderista-select-label">Mercaderista (Opcional)</InputLabel>
              <Select
                labelId="mercaderista-select-label"
                value={selectedMercaderista}
                label="Mercaderista (Opcional)"
                onChange={(e) => setSelectedMercaderista(e.target.value)}
              >
                <MenuItem value="">
                  <em>Todos</em>
                </MenuItem>
                {mercaderistas.map((m) => (
                  <MenuItem key={m.id} value={m.id}>{m.full_name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
        <Button
          variant="contained"
          onClick={handleGenerateSummary}
          disabled={loadingSummary}
        >
          {loadingSummary ? <CircularProgress size={24} /> : 'Generar Resumen'}
        </Button>

        {summaryError && <Alert severity="error" sx={{ mt: 2 }}>{summaryError}</Alert>}

        {summary && (
          <Box sx={{ mt: 2, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1, whiteSpace: 'pre-wrap' }}>
            <Typography variant="body1">{summary}</Typography>
          </Box>
        )}
      </Paper>
    </AppLayout>
  );
}

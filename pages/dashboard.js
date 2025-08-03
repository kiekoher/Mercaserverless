import { useState, useEffect } from 'react';
import { useAuth } from '../context/Auth';
import { useRouter } from 'next/router';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
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

    fetchStats();
  }, [user, router]);

  const chartData = {
    labels: stats?.rutas_por_mercaderista?.map(item => item.mercaderista) || [],
    datasets: [
      {
        label: 'Total de Rutas Asignadas',
        data: stats?.rutas_por_mercaderista?.map(item => item.total_rutas) || [],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Rendimiento por Mercaderista',
      },
    },
  };

  if (loading || !user) {
    return <div>Cargando dashboard...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div style={{ padding: '40px' }}>
      <h1>Dashboard de Analítica</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.2em' }}>Total de Rutas</h2>
          <p style={{ fontSize: '2.5em', margin: '10px 0', fontWeight: 'bold' }}>{stats?.total_rutas ?? 0}</p>
        </div>
        <div style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.2em' }}>Total Puntos Visitados</h2>
          <p style={{ fontSize: '2.5em', margin: '10px 0', fontWeight: 'bold' }}>{stats?.total_puntos_visitados ?? 0}</p>
        </div>
      </div>

      <div>
        <h2>Desglose de Rutas</h2>
        <div style={{ maxWidth: '800px', margin: 'auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <Bar options={chartOptions} data={chartData} />
        </div>
      </div>
    </div>
  );
}

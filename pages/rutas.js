import { useState, useEffect, Fragment, useCallback } from 'react';
import { useAuth } from '../context/Auth';
import { useRouter } from 'next/router';
import {
  Box, Typography, Button, Grid, Paper, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Checkbox, FormControlLabel, FormGroup, Tooltip, Pagination
} from '@mui/material';
import AppLayout from '../components/AppLayout';
import { useDebounce } from '../hooks/useDebounce';
import { useSnackbar } from 'notistack';

export default function RutasPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const [rutas, setRutas] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [mercaderistaId, setMercaderistaId] = useState('');
  const [selectedPuntos, setSelectedPuntos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [summaries, setSummaries] = useState({});
  const [summaryLoading, setSummaryLoading] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const fetchRutas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, search: debouncedSearchTerm });
      const res = await fetch(`/api/rutas?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch routes');
      const data = await res.json();
      const totalCount = res.headers.get('X-Total-Count');
      setTotalPages(Math.ceil(totalCount / 10));
      setRutas(data);
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearchTerm, enqueueSnackbar]);

  useEffect(() => {
    const fetchPuntosDeVenta = async () => {
      try {
        const res = await fetch('/api/puntos-de-venta');
        if(!res.ok) throw new Error('Failed to fetch points of sale');
        const data = await res.json();
        setPuntos(data);
      } catch(err) {
        enqueueSnackbar(err.message, { variant: 'error' });
      }
    };
    if(user) {
      fetchRutas();
      fetchPuntosDeVenta();
    }
  }, [user, fetchRutas, enqueueSnackbar]);

  const handleOptimizeRoute = async () => {
    if (selectedPuntos.length < 2) {
      enqueueSnackbar("Selecciona al menos 2 puntos para optimizar.", { variant: 'warning' });
      return;
    }
    setIsOptimizing(true);
    try {
      const puntosAOptimizar = puntos.filter(p => selectedPuntos.includes(p.id));
      const res = await fetch('/api/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puntos: puntosAOptimizar }),
      });
      if (!res.ok) throw new Error('La optimización falló');
      const data = await res.json();
      const optimizedIds = data.optimizedPuntos.map(p => p.id);
      const remainingPuntos = puntos.filter(p => !optimizedIds.includes(p.id));
      setPuntos([...data.optimizedPuntos, ...remainingPuntos]);
      setSelectedPuntos(optimizedIds);
      enqueueSnackbar('Ruta optimizada con IA!', { variant: 'info' });
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedPuntos.length === 0) {
      enqueueSnackbar('Debes seleccionar al menos un punto de venta.', { variant: 'warning' });
      return;
    }
    setIsSubmitting(true);
    try {
      await fetch('/api/rutas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, mercaderistaId, puntosDeVentaIds: selectedPuntos }),
      });
      setMercaderistaId('');
      setSelectedPuntos([]);
      enqueueSnackbar('Ruta creada con éxito!', { variant: 'success' });
      await fetchRutas();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateSummary = async (ruta) => {
    setSummaryLoading(ruta.id);
    try {
      const puntosDeRuta = ruta.puntosDeVentaIds.map(id => puntos.find(p => p.id === id)).filter(Boolean);
      const res = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha: ruta.fecha, mercaderistaId: ruta.mercaderistaId, puntos: puntosDeRuta }),
      });
      if (!res.ok) throw new Error('Failed to generate summary');
      const data = await res.json();
      setSummaries(prev => ({ ...prev, [ruta.id]: data.summary }));
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setSummaryLoading(null);
    }
  };

  // ... render logic remains largely the same, but without the top-level Alert component
  return (
    <AppLayout>
      {/* ... */}
    </AppLayout>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/Auth';
import {
  Typography, Button, Grid, Paper, TextField, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Box, Pagination, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, Chip
} from '@mui/material';
import AppLayout from '../components/AppLayout';
import { useDebounce } from '../hooks/useDebounce';
import { useSnackbar } from 'notistack';
import { useAuthorization } from '../hooks/useAuthorization';
import { useCsrfFetcher } from '../lib/fetchWithCsrf';
import Papa from 'papaparse';

const CSVImport = ({ onImport, isImporting }) => {
  const { enqueueSnackbar } = useSnackbar();
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        enqueueSnackbar('El archivo excede el tamaño máximo de 2MB', { variant: 'error' });
        return;
      }
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          onImport(results.data);
        },
        error: (error) => {
          console.error('Error parsing CSV:', error);
        }
      });
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>Importar desde CSV</Typography>
      <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
        Columnas requeridas: `nombre`, `direccion`, `ciudad`.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
        Columnas opcionales: `CUOTA`, `TIPOLOGIA`, `FRECUENCIA`, `MINUTOS SERVICIO`.
      </Typography>
      <Button
        variant="contained"
        component="label"
        disabled={isImporting}
      >
        {isImporting ? <CircularProgress size={24} /> : 'Seleccionar Archivo'}
        <input type="file" accept=".csv" hidden onChange={handleFileChange} />
      </Button>
    </Paper>
  );
};


export default function PuntosDeVentaPage() {
  const { user } = useAuth();
  const { can, role } = useAuthorization();
  const { enqueueSnackbar } = useSnackbar();
  const fetchWithCsrf = useCsrfFetcher();
  const [puntos, setPuntos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Dialog state for edit/delete
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [currentPunto, setCurrentPunto] = useState(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [editCiudad, setEditCiudad] = useState('');
  const [editCuota, setEditCuota] = useState('');
  const [editTipologia, setEditTipologia] = useState('');
  const [editFrecuencia, setEditFrecuencia] = useState('');
  const [editMinutos, setEditMinutos] = useState('');

  // Pagination and Search state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const fetchPuntos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, search: debouncedSearchTerm });
      const res = await fetch(`/api/puntos-de-venta?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch');
      }
      const data = await res.json();
      const totalCount = res.headers.get('X-Total-Count');
      setTotalPages(Math.ceil(totalCount / 10));
      setPuntos(data);
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearchTerm, enqueueSnackbar]);

  useEffect(() => {
    if (user) fetchPuntos();
  }, [user, fetchPuntos]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetchWithCsrf('/api/puntos-de-venta', {
        method: 'POST',
        body: JSON.stringify({ nombre, direccion, ciudad }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create point of sale');
      }
      setNombre('');
      setDireccion('');
      setCiudad('');
      enqueueSnackbar('Punto de venta creado con éxito!', { variant: 'success' });
      // Reset to page 1 to see the new entry if not searching
      if (page !== 1) setPage(1); 
      await fetchPuntos();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImport = async (puntos) => {
    setIsImporting(true);
    try {
      const res = await fetchWithCsrf('/api/import-pdv', {
        method: 'POST',
        body: JSON.stringify({ puntos }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error en la importación masiva.');
      }
      enqueueSnackbar(data.message, { variant: 'success' });
      fetchPuntos(); // Refresh the list
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setIsImporting(false);
    }
  };

  const openEditDialog = (punto) => {
    setCurrentPunto(punto);
    setEditNombre(punto.nombre);
    setEditDireccion(punto.direccion);
    setEditCiudad(punto.ciudad);
    setEditCuota(punto.cuota || '');
    setEditTipologia(punto.tipologia || '');
    setEditFrecuencia(punto.frecuencia_mensual || '');
    setEditMinutos(punto.minutos_servicio || '');
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    try {
      const res = await fetchWithCsrf('/api/puntos-de-venta', {
        method: 'PUT',
        body: JSON.stringify({
          id: currentPunto.id,
          nombre: editNombre,
          direccion: editDireccion,
          ciudad: editCiudad,
          cuota: editCuota,
          tipologia: editTipologia,
          frecuencia_mensual: editFrecuencia,
          minutos_servicio: editMinutos,
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al actualizar');
      }
      enqueueSnackbar('Punto de venta actualizado', { variant: 'success' });
      setEditOpen(false);
      fetchPuntos();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    }
  };

  const openDeleteDialog = (punto) => {
    setCurrentPunto(punto);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const res = await fetchWithCsrf(`/api/puntos-de-venta?id=${currentPunto.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al eliminar');
      }
      enqueueSnackbar('Punto de venta eliminado', { variant: 'success' });
      setDeleteOpen(false);
      fetchPuntos();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    }
  };

  if (!user || !role) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>;
  }

  const hasPermission = can(['supervisor', 'admin']);

  if (!hasPermission) {
    return <AppLayout><Alert severity="error">No tienes permiso para ver esta página.</Alert></AppLayout>
  }

  return (
    <AppLayout>
      <Typography variant="h4" gutterBottom>Gestión de Puntos de Venta</Typography>
      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          <Paper>
            <Box sx={{ p: 2 }}>
              <TextField
                fullWidth
                label="Buscar por nombre"
                variant="outlined"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Nombre</TableCell>
                    <TableCell>Tipología</TableCell>
                    <TableCell>Frecuencia</TableCell>
                    <TableCell>T. Servicio</TableCell>
                    <TableCell>Dirección</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} align="center"><CircularProgress /></TableCell></TableRow>
                  ) : puntos.length === 0 ? (
                    <TableRow><TableCell colSpan={6} align="center">No se encontraron puntos de venta.</TableCell></TableRow>
                  ) : puntos.map((punto) => {
                    const tipologiaColor = {
                        'A': 'error',
                        'B': 'warning',
                        'C': 'info',
                    }[punto.tipologia] || 'default';

                    return (
                        <TableRow key={punto.id}>
                            <TableCell>{punto.nombre}</TableCell>
                            <TableCell>
                                {punto.tipologia && <Chip label={punto.tipologia} color={tipologiaColor} size="small" />}
                            </TableCell>
                            <TableCell align="center">{punto.frecuencia_mensual || '-'}</TableCell>
                            <TableCell align="center">{punto.minutos_servicio || '-'}</TableCell>
                            <TableCell>{punto.direccion}</TableCell>
                            <TableCell align="right">
                                <Button size="small" onClick={() => openEditDialog(punto)}>Editar</Button>
                                <Button size="small" color="error" onClick={() => openDeleteDialog(punto)}>Eliminar</Button>
                            </TableCell>
                        </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(e, value) => setPage(value)}
                color="primary"
                disabled={loading}
              />
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Box>
            <Typography variant="h6" gutterBottom>Añadir Nuevo Punto</Typography>
            <Paper component="form" onSubmit={handleSubmit} sx={{ p: 2, mb: 2 }}>
              <TextField label="Nombre del Punto" value={nombre} onChange={(e) => setNombre(e.target.value)} fullWidth required sx={{ mb: 2 }} />
              <TextField label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} fullWidth required sx={{ mb: 2 }} />
              <TextField label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} fullWidth required sx={{ mb: 2 }} />
              <Button type="submit" variant="contained" fullWidth disabled={isSubmitting}>
                {isSubmitting ? <CircularProgress size={24} /> : 'Guardar Punto'}
              </Button>
            </Paper>
            <CSVImport onImport={handleImport} isImporting={isImporting} />
          </Box>
        </Grid>
      </Grid>
      <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
        <DialogTitle>Editar Punto de Venta</DialogTitle>
        <DialogContent>
          <TextField margin="dense" label="Nombre" fullWidth value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
          <TextField margin="dense" label="Dirección" fullWidth value={editDireccion} onChange={(e) => setEditDireccion(e.target.value)} />
          <TextField margin="dense" label="Ciudad" fullWidth value={editCiudad} onChange={(e) => setEditCiudad(e.target.value)} />
          <TextField margin="dense" label="Tipología" fullWidth value={editTipologia} onChange={(e) => setEditTipologia(e.target.value)} helperText="Ej: A, B, C" />
          <TextField margin="dense" label="Cuota" fullWidth value={editCuota} onChange={(e) => setEditCuota(e.target.value)} type="number" />
          <TextField margin="dense" label="Frecuencia Mensual" fullWidth value={editFrecuencia} onChange={(e) => setEditFrecuencia(e.target.value)} type="number" />
          <TextField margin="dense" label="Minutos de Servicio" fullWidth value={editMinutos} onChange={(e) => setEditMinutos(e.target.value)} type="number" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button onClick={handleEditSubmit}>Guardar</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Confirmar eliminación</DialogTitle>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancelar</Button>
          <Button color="error" onClick={handleDeleteConfirm}>Eliminar</Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/Auth';
import { useDebounce } from '../../hooks/useDebounce';
import {
  Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Alert,
  Box, Select, MenuItem, FormControl, TextField, Pagination
} from '@mui/material';
import AppLayout from '../../components/AppLayout';
import { useSnackbar } from 'notistack'; // Importar useSnackbar
import { useAuthorization } from '../../hooks/useAuthorization';
import { useCsrfFetcher } from '../../lib/fetchWithCsrf';

export default function UserManagementPage() {
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const { can, role } = useAuthorization();
  const fetchWithCsrf = useCsrfFetcher();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState({});

  // Pagination and Search state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, search: debouncedSearchTerm });
      const res = await fetch(`/api/users?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch users');
      }
      const { data, totalCount } = await res.json();
      setTotalPages(Math.ceil(totalCount / 20)); // Assuming page size of 20
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearchTerm]);

  useEffect(() => {
    if (role) {
      if (can('admin')) {
        fetchUsers();
      } else {
        setLoading(false);
        setError('No tienes permiso para acceder a esta página.');
      }
    }
  }, [role, can, fetchUsers]);

  const handleRoleChange = (userId, newRole) => {
    setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  const handleSaveRole = async (userId) => {
    setSaving(prev => ({ ...prev, [userId]: true }));
    setError(null);
    const userToUpdate = users.find(u => u.id === userId);
    try {
      const res = await fetchWithCsrf('/api/users', {
        method: 'PUT',
        body: JSON.stringify({ userId, newRole: userToUpdate.role }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update role');
      }
      enqueueSnackbar('Rol de usuario actualizado con éxito', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
      setError(err.message);
      fetchUsers(); // Re-fetch to revert optimistic update on error
    } finally {
      setSaving(prev => ({ ...prev, [userId]: false }));
    }
  };

  if (!user || !role) {
    return <AppLayout><Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box></AppLayout>;
  }
  if (!can('admin')) {
    return <AppLayout><Alert severity="error">No tienes permiso para acceder a esta página.</Alert></AppLayout>;
  }

  return (
    <AppLayout>
      <Typography variant="h4" gutterBottom>Administración de Usuarios</Typography>
      {/* El error ahora se manejará principalmente por el Snackbar, pero mantenemos esto como respaldo */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
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
                <TableCell>ID de Usuario</TableCell>
                <TableCell>Nombre Completo</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} align="center"><CircularProgress /></TableCell></TableRow>
              ) : users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{u.id}</TableCell>
                  <TableCell>{u.full_name || 'N/A'}</TableCell>
                  <TableCell>
                    <FormControl size="small">
                      <Select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        data-testid={`role-select-${u.id}`}
                      >
                        <MenuItem value="admin">Admin</MenuItem>
                        <MenuItem value="supervisor">Supervisor</MenuItem>
                        <MenuItem value="mercaderista">Mercaderista</MenuItem>
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleSaveRole(u.id)}
                      disabled={saving[u.id]}
                    >
                      {saving[u.id] ? <CircularProgress size={20} /> : 'Guardar'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
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
    </AppLayout>
  );
}

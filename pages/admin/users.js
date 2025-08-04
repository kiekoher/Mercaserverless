import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/Auth';
import {
  Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Alert,
  Box, Select, MenuItem, FormControl
} from '@mui/material';
import AppLayout from '../../components/AppLayout';
import { useSnackbar } from 'notistack'; // Importar useSnackbar

export default function UserManagementPage() {
  const { user, profile } = useAuth();
  const { enqueueSnackbar } = useSnackbar(); // Usar el hook
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState({});

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch users');
      }
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile) {
      if (profile.role === 'admin') {
        fetchUsers();
      } else {
        setLoading(false); // Detener el loading si no tiene permisos
        setError('No tienes permiso para acceder a esta página.');
      }
    }
  }, [profile, fetchUsers]);

  const handleRoleChange = (userId, newRole) => {
    setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  const handleSaveRole = async (userId) => {
    setSaving(prev => ({ ...prev, [userId]: true }));
    setError(null);
    const userToUpdate = users.find(u => u.id === userId);
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newRole: userToUpdate.role }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to update role');
      }
      // **MEJORA: Añadir mensaje de éxito**
      enqueueSnackbar('Rol de usuario actualizado con éxito', { variant: 'success' });
    } catch (err) {
      // **MEJORA: Mostrar error en Snackbar también**
      enqueueSnackbar(err.message, { variant: 'error' });
      setError(err.message);
      fetchUsers(); // Re-fetch to revert optimistic update on error
    } finally {
      setSaving(prev => ({ ...prev, [userId]: false }));
    }
  };

  if (!user || !profile) {
    return <AppLayout><Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box></AppLayout>;
  }

  if (profile.role !== 'admin') {
    return <AppLayout><Alert severity="error">No tienes permiso para acceder a esta página.</Alert></AppLayout>;
  }

  return (
    <AppLayout>
      <Typography variant="h4" gutterBottom>Administración de Usuarios</Typography>
      {/* El error ahora se manejará principalmente por el Snackbar, pero mantenemos esto como respaldo */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper>
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
      </Paper>
    </AppLayout>
  );
}

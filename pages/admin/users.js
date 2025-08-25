import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/Auth';
import { useDebounce } from '../../hooks/useDebounce';
import {
  Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Alert,
  Box, Select, MenuItem, FormControl, TextField, Pagination,
  Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
} from '@mui/material';
import AppLayout from '../../components/AppLayout';
import { useSnackbar } from 'notistack';
import { useAuthorization } from '../../hooks/useAuthorization';
import { useCsrfFetcher } from '../../lib/fetchWithCsrf';

export default function UserManagementPage() {
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const { can, role } = useAuthorization();
  const fetchWithCsrf = useCsrfFetcher();

  // Existing state
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // New state for invite/delete functionality
  const [isInviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('mercaderista');
  const [isInviting, setIsInviting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);


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

  const handleInvite = async () => {
    setIsInviting(true);
    try {
      const res = await fetchWithCsrf('/api/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al invitar al usuario.');

      enqueueSnackbar('Invitación enviada correctamente.', { variant: 'success' });
      setInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('mercaderista');
      fetchUsers(); // Refresh user list
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setIsInviting(false);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetchWithCsrf(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar el usuario.');

      enqueueSnackbar('Usuario eliminado correctamente.', { variant: 'success' });
      setConfirmDeleteOpen(false);
      setUserToDelete(null);
      fetchUsers(); // Refresh user list
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setIsDeleting(false);
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>Administración de Usuarios</Typography>
        <Button variant="contained" onClick={() => setInviteModalOpen(true)}>Invitar Usuario</Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper>
        <Box sx={{ p: 2 }}>
          <TextField fullWidth label="Buscar por nombre o email" variant="outlined" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nombre Completo</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} align="center"><CircularProgress /></TableCell></TableRow>
              ) : users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.full_name || 'N/A (Invitado)'}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.role}</TableCell>
                  <TableCell align="right">
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => { setUserToDelete(u); setConfirmDeleteOpen(true); }}
                      disabled={u.id === user.id} // Disable deleting self
                    >
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
          <Pagination count={totalPages} page={page} onChange={(e, value) => setPage(value)} color="primary" disabled={loading} />
        </Box>
      </Paper>

      {/* Invite User Modal */}
      <Dialog open={isInviteModalOpen} onClose={() => setInviteModalOpen(false)}>
        <DialogTitle>Invitar Nuevo Usuario</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Ingresa el email y asigna un rol. El usuario recibirá un correo para configurar su cuenta.
          </DialogContentText>
          <TextField autoFocus margin="dense" id="email" label="Dirección de Email" type="email" fullWidth variant="standard" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <FormControl fullWidth margin="dense" variant="standard">
            <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <MenuItem value="mercaderista">Mercaderista</MenuItem>
              <MenuItem value="supervisor">Supervisor</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteModalOpen(false)}>Cancelar</Button>
          <Button onClick={handleInvite} variant="contained" disabled={isInviting}>
            {isInviting ? <CircularProgress size={24} /> : 'Enviar Invitación'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
        <DialogTitle>Confirmar Eliminación</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Estás seguro de que quieres eliminar al usuario <strong>{userToDelete?.email}</strong>? Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)}>Cancelar</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={isDeleting}>
            {isDeleting ? <CircularProgress size={24} /> : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

    </AppLayout>
  );
}

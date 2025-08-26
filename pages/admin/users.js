import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Grid, Paper, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Pagination, Alert, Modal,
  Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, InputLabel, FormControl, IconButton, Tooltip
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AppLayout from '../../components/AppLayout';
import { useAuthorization } from '../../hooks/useAuthorization';
import { useDebounce } from '../../hooks/useDebounce';
import { useCsrfFetcher } from '../../lib/fetchWithCsrf';
import { useSnackbar } from 'notistack';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: { xs: '90%', md: 400 },
  bgcolor: 'background.paper',
  border: '1px solid #ddd',
  borderRadius: '8px',
  boxShadow: 24,
  p: 4,
};

export default function UsersPage() {
  const { can, user, role } = useAuthorization(['admin', 'supervisor']);
  const fetchWithCsrf = useCsrfFetcher();
  const { enqueueSnackbar } = useSnackbar();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Modals state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const [userToEdit, setUserToEdit] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);

  // Form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('mercaderista');
  const [editRole, setEditRole] = useState('mercaderista');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, search: debouncedSearchTerm, pageSize: 20 });
      const res = await fetch(`/api/users?${params.toString()}`);
      if (!res.ok) throw new Error('Error al cargar los usuarios.');
      const { data, totalCount } = await res.json();
      setUsers(data);
      setTotalPages(Math.ceil(totalCount / 20));
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearchTerm, enqueueSnackbar]);

  useEffect(() => {
    if (user) {
      fetchUsers();
    }
  }, [user, fetchUsers]);

  const handleInviteUser = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetchWithCsrf('/api/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al invitar al usuario.');
      enqueueSnackbar('Invitación enviada con éxito.', { variant: 'success' });
      setInviteModalOpen(false);
      setInviteEmail('');
      setInviteRole('mercaderista');
      fetchUsers();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetchWithCsrf(`/api/users/${userToEdit.id}`, {
        method: 'PUT',
        body: JSON.stringify({ role: editRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar el rol.');
      enqueueSnackbar('Rol actualizado con éxito.', { variant: 'success' });
      setEditModalOpen(false);
      fetchUsers();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetchWithCsrf(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar el usuario.');
      enqueueSnackbar('Usuario eliminado con éxito.', { variant: 'success' });
      setDeleteModalOpen(false);
      fetchUsers();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (user) => {
    setUserToEdit(user);
    setEditRole(user.role);
    setEditModalOpen(true);
  };

  const openDeleteModal = (user) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  if (!user) return <AppLayout><Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box></AppLayout>;
  if (!can) return <AppLayout><Alert severity="error">No tienes permiso para ver esta página.</Alert></AppLayout>;

  return (
    <AppLayout>
      <Typography variant="h4" gutterBottom>Gestión de Usuarios</Typography>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} justifyContent="space-between" alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Buscar por nombre de usuario"
              variant="outlined"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Grid>
          <Grid item>
            <Button variant="contained" onClick={() => setInviteModalOpen(true)}>Invitar Usuario</Button>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
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
                <TableCell><Tooltip title={u.id}><Typography variant="body2" sx={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 100 }}>{u.id}</Typography></Tooltip></TableCell>
                <TableCell>{u.full_name || '(invitado)'}</TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => openEditModal(u)} disabled={u.id === user.id}><EditIcon /></IconButton>
                  <IconButton onClick={() => openDeleteModal(u)} disabled={u.id === user.id}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
        <Pagination count={totalPages} page={page} onChange={(e, value) => setPage(value)} color="primary" disabled={loading} />
      </Box>

      {/* Invite User Modal */}
      <Modal open={inviteModalOpen} onClose={() => setInviteModalOpen(false)}>
        <Box sx={modalStyle}>
          <Typography variant="h6" gutterBottom>Invitar Nuevo Usuario</Typography>
          <TextField label="Email" type="email" fullWidth value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} sx={{ mb: 2 }} />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Rol</InputLabel>
            <Select value={inviteRole} label="Rol" onChange={e => setInviteRole(e.target.value)}>
              <MenuItem value="mercaderista">Mercaderista</MenuItem>
              <MenuItem value="supervisor">Supervisor</MenuItem>
              {role === 'admin' && <MenuItem value="admin">Admin</MenuItem>}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={handleInviteUser} disabled={isSubmitting} fullWidth>
            {isSubmitting ? <CircularProgress size={24} /> : 'Enviar Invitación'}
          </Button>
        </Box>
      </Modal>

      {/* Edit User Modal */}
      <Dialog open={editModalOpen} onClose={() => setEditModalOpen(false)}>
        <DialogTitle>Editar Rol de {userToEdit?.full_name || 'usuario'}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Rol</InputLabel>
            <Select value={editRole} label="Rol" onChange={e => setEditRole(e.target.value)}>
              <MenuItem value="mercaderista">Mercaderista</MenuItem>
              <MenuItem value="supervisor">Supervisor</MenuItem>
              {role === 'admin' && <MenuItem value="admin">Admin</MenuItem>}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditModalOpen(false)}>Cancelar</Button>
          <Button onClick={handleUpdateRole} disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={24} /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete User Confirmation */}
      <Dialog open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
        <DialogTitle>¿Estás seguro de que quieres eliminar a {userToDelete?.full_name || 'este usuario'}?</DialogTitle>
        <DialogContent>
          <Typography>Esta acción es irreversible.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteModalOpen(false)}>Cancelar</Button>
          <Button onClick={handleDeleteUser} color="error" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={24} /> : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}

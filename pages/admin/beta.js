import { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, CircularProgress, Alert, Modal,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Tooltip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AppLayout from '../../components/AppLayout';
import { useAuthorization } from '../../hooks/useAuthorization';
import { useCsrfFetcher } from '../../lib/fetchWithCsrf';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';

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

export default function BetaInvitesPage() {
  const { can, user } = useAuthorization(['admin']);
  const fetchWithCsrf = useCsrfFetcher();
  const { enqueueSnackbar } = useSnackbar();

  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const [inviteToDelete, setInviteToDelete] = useState(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNote, setInviteNote] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchInvites = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/beta-invites');
      if (!res.ok) throw new Error('Error al cargar la lista de invitaciones.');
      const { data } = await res.json();
      setInvites(data);
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    if (can) {
      fetchInvites();
    }
  }, [can, fetchInvites]);

  const handleAddInvite = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetchWithCsrf('/api/admin/beta-invites', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, note: inviteNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al añadir la invitación.');
      enqueueSnackbar('Invitación añadida con éxito.', { variant: 'success' });
      setInviteModalOpen(false);
      setInviteEmail('');
      setInviteNote('');
      fetchInvites();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInvite = async () => {
    if (!inviteToDelete) return;
    setIsSubmitting(true);
    try {
      const res = await fetchWithCsrf('/api/admin/beta-invites', {
        method: 'DELETE',
        body: JSON.stringify({ email: inviteToDelete.email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error al eliminar la invitación.');
      }
      enqueueSnackbar('Invitación eliminada con éxito.', { variant: 'success' });
      setDeleteModalOpen(false);
      setInviteToDelete(null);
      fetchInvites();
    } catch (err) {
      enqueueSnackbar(err.message, { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteModal = (invite) => {
    setInviteToDelete(invite);
    setDeleteModalOpen(true);
  };

  if (!user) return <AppLayout><Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box></AppLayout>;
  if (!can) return <AppLayout><Alert severity="error">No tienes permiso para ver esta página.</Alert></AppLayout>;

  return (
    <AppLayout>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" gutterBottom>Gestión de Invitaciones Beta</Typography>
        <Button variant="contained" onClick={() => setInviteModalOpen(true)}>Añadir Invitación</Button>
      </Box>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography>Aquí puedes gestionar qué correos electrónicos están autorizados para crear una cuenta durante el periodo de beta cerrada.</Typography>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Correo Electrónico</TableCell>
              <TableCell>Nota</TableCell>
              <TableCell>Fecha de Invitación</TableCell>
              <TableCell>Invitado por</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} align="center"><CircularProgress /></TableCell></TableRow>
            ) : invites.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center">No hay invitaciones todavía.</TableCell></TableRow>
            ) : invites.map((invite) => (
              <TableRow key={invite.email}>
                <TableCell>{invite.email}</TableCell>
                <TableCell>{invite.note || 'N/A'}</TableCell>
                <TableCell>{format(new Date(invite.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                <TableCell>{invite.inviter?.full_name || 'N/A'}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Eliminar invitación">
                    <IconButton onClick={() => openDeleteModal(invite)}><DeleteIcon /></IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Invite User Modal */}
      <Modal open={inviteModalOpen} onClose={() => setInviteModalOpen(false)}>
        <Box sx={modalStyle}>
          <Typography variant="h6" gutterBottom>Añadir Correo a la Beta</Typography>
          <TextField label="Email" type="email" fullWidth value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} sx={{ mb: 2 }} />
          <TextField label="Nota (Opcional)" type="text" fullWidth value={inviteNote} onChange={e => setInviteNote(e.target.value)} sx={{ mb: 2 }} />
          <Button variant="contained" onClick={handleAddInvite} disabled={isSubmitting} fullWidth>
            {isSubmitting ? <CircularProgress size={24} /> : 'Añadir a la lista'}
          </Button>
        </Box>
      </Modal>

      {/* Delete Invite Confirmation */}
      <Dialog open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
        <DialogTitle>¿Eliminar invitación para {inviteToDelete?.email}?</DialogTitle>
        <DialogContent>
          <Typography>Esta acción revocará el acceso al registro para este correo si todavía no ha creado una cuenta.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteModalOpen(false)}>Cancelar</Button>
          <Button onClick={handleDeleteInvite} color="error" disabled={isSubmitting}>
            {isSubmitting ? <CircularProgress size={24} /> : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}

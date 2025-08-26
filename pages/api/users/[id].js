import { z } from 'zod';
import logger from '../../../lib/logger.server';
import { requireUser } from '../../../lib/auth';

async function handler(req, res) {
  const { id: targetUserId } = req.query;
  const { supabase, user: currentUser, role: currentUserRole } = await requireUser(req, res, ['admin', 'supervisor']);

  if (!currentUser) {
    return res.status(401).json({ error: 'No autenticado.' });
  }

  if (currentUser.id === targetUserId) {
    return res.status(400).json({ error: 'No puedes modificar o eliminar tu propia cuenta.' });
  }

  switch (req.method) {
    case 'PUT':
      const schema = z.object({
        role: z.enum(['admin', 'supervisor', 'mercaderista']),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'El rol es requerido y debe ser válido.' });
      }
      const { role: newRole } = parsed.data;

      if (currentUserRole === 'supervisor' && newRole === 'admin') {
        return res.status(403).json({ error: 'Un supervisor no puede promover a otros a admin.' });
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', targetUserId)
          .select('id, full_name, role')
          .single();

        if (error) throw error;
        return res.status(200).json(data);
      } catch (err) {
        logger.error({ err, targetUserId, newRole }, 'Error al actualizar el rol del usuario.');
        return res.status(500).json({ error: 'Error interno al actualizar el usuario.' });
      }

    case 'DELETE':
      try {
        const { data: targetUserProfile, error: targetProfileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', targetUserId)
          .single();

        if (targetProfileError || !targetUserProfile) {
            return res.status(404).json({ error: 'Usuario a eliminar no encontrado.' });
        }

        if (currentUserRole === 'supervisor' && targetUserProfile.role === 'supervisor') {
            return res.status(403).json({ error: 'Un supervisor no puede eliminar a otro supervisor.' });
        }
        if (currentUserRole === 'supervisor' && targetUserProfile.role === 'admin') {
            return res.status(403).json({ error: 'Un supervisor no puede eliminar a un administrador.' });
        }

        const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId);

        if (deleteError) {
          logger.error({ err: deleteError, targetUserId }, 'Error al eliminar el usuario con Supabase.');
          return res.status(500).json({ error: 'Error interno al eliminar el usuario.' });
        }

        logger.info({ targetUserId, deletedBy: currentUser.id }, 'Usuario eliminado exitosamente.');
        return res.status(200).json({ message: 'Usuario eliminado correctamente.' });

      } catch (err) {
        logger.error({ err, targetUserId }, 'Error inesperado en el endpoint de eliminación de usuario.');
        return res.status(500).json({ error: 'Ocurrió un error en el servidor.' });
      }

    default:
      res.setHeader('Allow', ['PUT', 'DELETE']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

export default handler;

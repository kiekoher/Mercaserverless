import { getSupabaseServerClient } from '../../../lib/supabaseServer';
import logger from '../../../lib/logger.server';
import { getUserProfile } from '../../../lib/auth';

async function handler(req, res) {
  const { id: targetUserId } = req.query;

  const supabase = getSupabaseServerClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'No autenticado.' });
  }

  // Authorization: Only supervisors can delete users.
  const userProfile = await getUserProfile(supabase, session.user.id);
  if (!userProfile || userProfile.role !== 'supervisor') {
    return res.status(403).json({ error: 'No autorizado para realizar esta acción.' });
  }

  // A supervisor cannot delete themselves.
  if (session.user.id === targetUserId) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' });
  }

  switch (req.method) {
    case 'DELETE':
      try {
        // Fetch the role of the user being deleted to prevent a supervisor from deleting another.
        const { data: targetUserProfile, error: targetProfileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', targetUserId)
          .single();

        if (targetProfileError || !targetUserProfile) {
            return res.status(404).json({ error: 'Usuario a eliminar no encontrado.' });
        }

        if (targetUserProfile.role === 'supervisor') {
            return res.status(403).json({ error: 'No se puede eliminar a otro supervisor.' });
        }

        const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId);

        if (deleteError) {
          logger.error({ err: deleteError, targetUserId }, 'Error al eliminar el usuario con Supabase.');
          return res.status(500).json({ error: 'Error interno al eliminar el usuario.' });
        }

        logger.info({ targetUserId, deletedBy: session.user.id }, 'Usuario eliminado exitosamente.');
        return res.status(200).json({ message: 'Usuario eliminado correctamente.' });

      } catch (err) {
        logger.error({ err, targetUserId }, 'Error inesperado en el endpoint de eliminación de usuario.');
        return res.status(500).json({ error: 'Ocurrió un error en el servidor.' });
      }

    default:
      res.setHeader('Allow', ['DELETE']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

export default handler;

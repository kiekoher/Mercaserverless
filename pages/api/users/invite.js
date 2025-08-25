import { getSupabaseServerClient } from '../../../lib/supabaseServer';
import logger from '../../../lib/logger.server';
import { z } from 'zod';
import { sendTransactionalEmail, WelcomeEmail } from '../../../lib/email';
import { getUserProfile } from '../../../lib/auth';

const inviteUserSchema = z.object({
  email: z.string().email({ message: 'Email inválido.' }),
  role: z.enum(['mercaderista', 'supervisor'], { message: 'Rol inválido.' }),
});

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const supabase = getSupabaseServerClient(req, res);
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return res.status(401).json({ error: 'No autenticado.' });
  }

  // Authorization: Only supervisors can invite users.
  const userProfile = await getUserProfile(supabase, session.user.id);
  if (!userProfile || userProfile.role !== 'supervisor') {
    return res.status(403).json({ error: 'No autorizado para realizar esta acción.' });
  }

  const result = inviteUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors });
  }

  const { email, role } = result.data;

  try {
    // Use Supabase Admin client to invite a new user
    const { data, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { role }, // Pass metadata to be stored with the user
    });

    if (inviteError) {
      logger.error({ err: inviteError, email }, 'Error al invitar al usuario con Supabase.');
      // Handle specific, common errors
      if (inviteError.message.includes('unique constraint')) {
        return res.status(409).json({ error: 'Un usuario con este email ya existe.' });
      }
      return res.status(500).json({ error: 'Error interno al invitar al usuario.' });
    }

    logger.info({ invitedUser: data.user, invitedBy: session.user.id }, 'Usuario invitado exitosamente via Supabase.');

    // Send a more user-friendly welcome email via Resend
    await sendTransactionalEmail({
      to: email,
      subject: '¡Bienvenido al equipo!',
      react: WelcomeEmail({ userEmail: email, supervisorName: userProfile.full_name || 'tu supervisor' }),
    });

    return res.status(200).json({ message: 'Invitación enviada correctamente.', user: data.user });

  } catch (err) {
    logger.error({ err, email }, 'Error inesperado en el endpoint de invitación de usuario.');
    return res.status(500).json({ error: 'Ocurrió un error en el servidor.' });
  }
}

export default handler;

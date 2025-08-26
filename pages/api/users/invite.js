import logger from '../../../lib/logger.server';
import { z } from 'zod';
import { sendTransactionalEmail, WelcomeEmail } from '../../../lib/email';
import { requireUser } from '../../../lib/auth';
import { checkRateLimit } from '../../../lib/rateLimiter';

const inviteUserSchema = z.object({
  email: z.string().email({ message: 'Email inválido.' }),
  role: z.enum(['mercaderista', 'supervisor'], { message: 'Rol inválido.' }),
});

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { supabase, user: currentUser, role: currentUserRole } = await requireUser(req, res, ['admin', 'supervisor']);

  if (!currentUser) {
    return res.status(401).json({ error: 'No autenticado.' });
  }

  if (!(await checkRateLimit(req, { userId: currentUser.id }))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  // The requireUser function already handles role checking, so this explicit check is redundant and can be removed.

  const result = inviteUserSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors });
  }

  const { email, role } = result.data;

  try {
    const { data: userProfile } = await supabase.from('profiles').select('full_name').eq('id', currentUser.id).single();
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

    logger.info({ invitedUser: data.user, invitedBy: currentUser.id }, 'Usuario invitado exitosamente via Supabase.');

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

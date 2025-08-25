import { createServerClient } from '@supabase/ssr';
import logger from '../../../lib/logger.server';
import { z } from 'zod';

const resetPasswordSchema = z.object({
  email: z.string().email('Por favor, introduce una dirección de email válida.'),
});

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const result = resetPasswordSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors.email[0] });
  }

  const { email } = result.data;

  // Supabase client creation cannot be done in lib/supabaseServer.js for this specific case
  // because we don't have the standard request/response flow for auth middleware.
  // We create a temporary, admin-like client here.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY, // Use the service role key for this admin-level action
    {
      cookies: {}, // No cookies involved in this server-to-server action
    }
  );

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${new URL(req.headers.origin).origin}/update-password`,
    });

    if (error) {
      logger.error({ err: error, email }, 'Error al intentar resetear la contraseña para el email.');
      // Do not reveal if the email exists in the system or not
      return res.status(200).json({ message: 'Si tu correo electrónico está en nuestro sistema, recibirás un enlace para recuperar tu contraseña.' });
    }

    logger.info({ email }, 'Solicitud de reseteo de contraseña enviada.');
    return res.status(200).json({ message: 'Si tu correo electrónico está en nuestro sistema, recibirás un enlace para recuperar tu contraseña.' });
  } catch (err) {
    logger.error({ err, email }, 'Error inesperado en el endpoint de reseteo de contraseña.');
    // Generic error to avoid leaking implementation details
    return res.status(500).json({ error: 'Ocurrió un error en el servidor. Por favor, inténtalo de nuevo más tarde.' });
  }
}

export default handler;

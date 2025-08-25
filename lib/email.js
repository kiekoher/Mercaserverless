import { Resend } from 'resend';
import logger from './logger.server';

let resend;

if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  logger.warn('RESEND_API_KEY is not configured. Transactional emails will not be sent.');
}

// Example React component for an email template. In a real app, this would be more complex
// and likely live in its own file (e.g., components/emails/InvitationEmail.js).
const WelcomeEmail = ({ userEmail, supervisorName }) => (
  <div>
    <h1>¡Bienvenido a la plataforma de optimización de rutas!</h1>
    <p>Hola {userEmail},</p>
    <p>Has sido invitado por <strong>{supervisorName}</strong> para unirte al equipo.</p>
    <p>Por favor, busca el correo de invitación de Supabase para configurar tu cuenta y contraseña.</p>
    <p>¡Estamos contentos de tenerte con nosotros!</p>
  </div>
);


/**
 * Sends a transactional email using Resend.
 * @param {object} params - The parameters for the email.
 * @param {string} params.to - The recipient's email address.
 * @param {string} params.subject - The subject of the email.
 * @param {React.ReactElement} params.react - The React component to use as the email body.
 * @returns {Promise<void>}
 */
export async function sendTransactionalEmail({ to, subject, react }) {
  if (!resend) {
    logger.warn({ to, subject }, 'Skipping email send because Resend is not configured.');
    // In development, we can "succeed" without sending an email.
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Onboarding <onboarding@resend.dev>', // Note: This domain must be verified with Resend.
      to,
      subject,
      react,
    });

    if (error) {
      logger.error({ err: error, to, subject }, 'Failed to send email via Resend.');
      // We might not want to throw here to avoid failing the entire operation just because email failed.
      // This depends on the criticality of the email.
      return;
    }

    logger.info({ messageId: data?.id, to, subject }, 'Transactional email sent successfully.');
  } catch (err) {
    logger.error({ err, to, subject }, 'An unexpected error occurred while sending an email.');
  }
}

// Exporting the template for use in API endpoints
export { WelcomeEmail };

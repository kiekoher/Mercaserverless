import { randomBytes } from 'crypto';

export default function handler(req, res) {
  const token = randomBytes(32).toString('hex');
  const isProd = process.env.NODE_ENV === 'production';

  // The __Host- prefix requires the Secure attribute and a Path of /.
  // It helps protect against cookie tossing.
  const cookieName = isProd ? '__Host-csrf-secret' : 'csrf-secret';

  const cookie = [
    `${cookieName}=${token}`,
    'Path=/',
    'SameSite=Strict',
    'HttpOnly',
    `Max-Age=${60 * 60 * 24}`, // 24 hours
    isProd ? 'Secure' : ''
  ].filter(Boolean).join('; ');

  res.setHeader('Set-Cookie', cookie);
  res.status(200).json({ csrfToken: token });
}

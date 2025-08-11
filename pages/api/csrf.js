import { randomBytes } from 'crypto';

export default function handler(req, res) {
  const token = randomBytes(32).toString('hex');
  const isProd = process.env.NODE_ENV === 'production';
  const cookie = [
    `csrf-token=${token}`,
    'Path=/',
    'SameSite=Lax',
    'Max-Age=3600',
    isProd ? 'Secure' : ''
  ].filter(Boolean).join('; ');
  res.setHeader('Set-Cookie', cookie);
  res.status(200).json({ csrfToken: token });
}
